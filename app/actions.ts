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
  redirect(`${path}?${key}=${encodeURIComponent(text)}`);

export async function uploadCv(form: FormData) {
  const file = form.get("cv");
  if (!(file instanceof File) || file.size === 0) back("/profile", "error", "Choose a CV file first.");
  const cv = file as File;
  const isPdf = cv.type === "application/pdf" || cv.name.toLowerCase().endsWith(".pdf");
  const isText = cv.type.startsWith("text/") || /\.(txt|md)$/i.test(cv.name);
  if (!isPdf && !isText) back("/profile", "error", "Upload the CV as a PDF or a plain text file.");

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
  if (error) back("/profile", "error", error);
  back("/profile", "ok", "CV read. Check the profile below, then set your preferences.");
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
  back("/profile", "ok", "Preferences saved.");
}

export async function addPlace(form: FormData) {
  const query = String(form.get("place") ?? "").trim();
  const radius = Number(form.get("radiusKm"));
  if (!query) back("/profile", "error", "Type a city or address.");
  let error: string | null = null;
  try {
    const hit = await geocodeSweden(query);
    if (!hit) {
      error = `Could not find "${query}" in Sweden.`;
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
  if (error) back("/profile", "error", error);
  redirect("/profile#places");
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
    const problems = s.sourceErrors.length ? ` Note: ${s.sourceErrors.join("; ")}.` : "";
    result = {
      key: "ok",
      text: `Found ${s.new} new postings, scored ${s.scored}${s.failed ? `, ${s.failed} failed to score` : ""}.${problems}`,
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
