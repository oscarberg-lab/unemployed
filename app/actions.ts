"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validFieldIds } from "@/lib/fields";
import { geocodeSweden } from "@/lib/geo";
import { getLlm } from "@/lib/llm-provider";
import { runPipeline } from "@/lib/pipeline";
import * as store from "@/lib/store";
import { STATUSES, type Preferences, type Status, type WorkMode } from "@/lib/types";

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
const list = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
const back = (path: string, key: "error" | "ok", text: string): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(text)}`);

export async function uploadCv(form: FormData) {
  const file = form.get("cv");
  if (!(file instanceof File) || file.size === 0) back("/profile?step=1", "error", "Choose your CV file first, then try again.");
  const cv = file as File;
  const isPdf = cv.type === "application/pdf" || cv.name.toLowerCase().endsWith(".pdf");
  const isText = cv.type.startsWith("text/") || /\.(txt|md)$/i.test(cv.name);
  if (!isPdf && !isText) back("/profile?step=1", "error", "That file type is not supported. Please upload your CV as a PDF or a plain text file.");

  let error: string | null = null;
  try {
    const profile = await getLlm().parseCv({
      filename: cv.name,
      mediaType: isPdf ? "application/pdf" : "text/plain",
      data: Buffer.from(await cv.arrayBuffer()),
    });
    await store.saveProfile(profile, cv.name);
    // Search terms come from the CV the first time; after that the user's edits win.
    const { prefs } = await store.getSettings();
    if (prefs.searchTerms.length === 0) await store.savePrefs({ ...prefs, searchTerms: profile.searchTerms });
  } catch (err) {
    error = message(err);
  }
  revalidatePath("/", "layout");
  if (error) back("/profile?step=1", "error", error);
  back("/profile?step=1", "ok", "We have read your CV. Have a look at the summary below, then continue.");
}

export async function savePreferences(form: FormData) {
  const { prefs } = await store.getSettings();
  const salary = Number(form.get("minSalarySek"));
  const digest = Number(form.get("digestMinScore"));
  const next: Preferences = {
    ...prefs,
    workModes: form.getAll("workModes").map(String) as WorkMode[],
    includeInternationalRemote: form.get("includeInternationalRemote") === "on",
    minSalarySek: Number.isFinite(salary) && salary > 0 ? Math.round(salary) : null,
    workingHours: form.getAll("workingHours").map(String) as Preferences["workingHours"],
    contractTypes: form.getAll("contractTypes").map(String) as Preferences["contractTypes"],
    avoidCompanies: list(form.get("avoidCompanies")),
    avoidIndustries: list(form.get("avoidIndustries")),
    searchTerms: list(form.get("searchTerms")),
    occupationFields: validFieldIds(form.getAll("occupationFields").map(String)),
    notes: String(form.get("notes") ?? "").trim(),
    digestMinScore: Number.isFinite(digest) ? Math.max(0, Math.min(100, Math.round(digest))) : prefs.digestMinScore,
  };
  await store.savePrefs(next);
  revalidatePath("/", "layout");
  back("/profile?step=3", "ok", "Your preferences are saved. They apply from the next search.");
}

export async function addPlace(form: FormData) {
  const query = String(form.get("place") ?? "").trim();
  const radius = Number(form.get("radiusKm"));
  if (!query) back("/profile?step=2", "error", "Type the name of a town or city.");
  let error: string | null = null;
  try {
    const hit = await geocodeSweden(query);
    if (!hit) {
      error = `We could not find “${query}” in Sweden. Check the spelling, or try a nearby town.`;
    } else {
      const { prefs } = await store.getSettings();
      const radiusKm = Number.isFinite(radius) && radius > 0 ? Math.min(radius, 500) : 30;
      await store.savePrefs({
        ...prefs,
        places: [...prefs.places.filter((p) => p.name !== hit.name), { ...hit, radiusKm }],
      });
    }
  } catch (err) {
    error = message(err);
  }
  revalidatePath("/profile");
  if (error) back("/profile?step=2", "error", error);
  redirect("/profile?step=2");
}

export async function removePlace(form: FormData) {
  const name = String(form.get("name"));
  const { prefs } = await store.getSettings();
  await store.savePrefs({ ...prefs, places: prefs.places.filter((p) => p.name !== name) });
  revalidatePath("/profile");
}

export async function runNow() {
  let result: { key: "ok" | "error"; text: string };
  try {
    const s = await runPipeline({ timeBudgetMs: 240_000 });
    const problems = s.sourceErrors.length ? ` Worth knowing: ${s.sourceErrors.join("; ")}.` : "";
    const found = s.new === 0 ? "No new postings since last time" : `We found ${s.new} new ${s.new === 1 ? "posting" : "postings"}`;
    result = {
      key: "ok",
      text: `${found} and graded ${s.scored}${s.failed ? ` (${s.failed} could not be graded and will be retried)` : ""}.${problems}`,
    };
  } catch (err) {
    result = { key: "error", text: message(err) };
  }
  revalidatePath("/", "layout");
  back("/", result.key, result.text);
}

export async function giveFeedback(form: FormData) {
  const id = String(form.get("id"));
  const value = String(form.get("feedback"));
  const note = String(form.get("note") ?? "").trim() || null;
  await store.setFeedback(id, value === "up" || value === "down" ? value : null, note);
  revalidatePath("/", "layout");
}

export async function changeStatus(form: FormData) {
  const status = String(form.get("status")) as Status;
  if (!STATUSES.includes(status)) return;
  await store.setStatus(String(form.get("id")), status);
  revalidatePath("/", "layout");
}

export async function saveNotes(form: FormData) {
  await store.setNotes(String(form.get("id")), String(form.get("notes") ?? ""));
  revalidatePath("/", "layout");
}

export async function writeCoverLetter(form: FormData) {
  const id = String(form.get("id"));
  const path = `/jobs/${encodeURIComponent(id)}`;
  let error: string | null = null;
  try {
    const [job, { profile }] = await Promise.all([store.getJob(id), store.getSettings()]);
    if (!job || !profile) throw new Error("Job or profile missing.");
    const letter = await getLlm().coverLetter(profile, store.toRawJob(job), String(form.get("extra") ?? "").trim());
    await store.setCoverLetter(id, letter);
  } catch (err) {
    error = message(err);
  }
  revalidatePath(path);
  if (error) back(path, "error", error);
  redirect(`${path}#letter`);
}
