import { beforeAll, describe, expect, it } from "vitest";
import { LlmConfigError, LlmQuotaError, type Llm } from "@/lib/llm";
import { runPipeline } from "@/lib/pipeline";
import type { Source } from "@/lib/sources/types";
import * as store from "@/lib/store";
import type { JobScore, RawJob } from "@/lib/types";
import { job, prefs, PROFILE } from "./helpers";

const score = (n: number, over: Partial<JobScore> = {}): JobScore => ({
  score: n,
  subscores: { skills: n, seniority: n, location: n, preferences: n },
  summary: "Fits.",
  strengths: ["TypeScript"],
  gaps: ["Kubernetes"],
  workMode: "hybrid",
  strictlyRemoteFromSweden: true,
  ...over,
});

function fakes(jobs: RawJob[], grade: (job: RawJob) => JobScore) {
  const scoredIds: string[] = [];
  const seenFeedback: string[][] = [];
  const source: Source = { name: "jobtech", label: "Test", enabled: () => true, fetch: async () => jobs };
  const broken: Source = { name: "broken", label: "Broken", enabled: () => true, fetch: async () => { throw new Error("site down"); } };
  const llm: Llm = {
    parseCv: async () => PROFILE,
    coverLetter: async () => "letter",
    scoreJob: async (ctx, j) => {
      scoredIds.push(j.externalId);
      seenFeedback.push(ctx.feedback.map((f) => `${f.feedback}:${f.title}`));
      if (j.title === "Explodes") throw new Error("model error");
      return grade(j);
    },
  };
  const emailed: string[][] = [];
  const sendDigest = async (rows: { id: string }[]) => {
    emailed.push(rows.map((r) => r.id));
    return rows.length > 0;
  };
  return { deps: { sources: [source, broken], llm, sendDigest }, scoredIds, seenFeedback, emailed };
}

describe("daily pipeline", () => {
  beforeAll(async () => {
    await store.saveProfile(PROFILE, "cv.pdf");
    await store.savePrefs(prefs({ includeInternationalRemote: true }));
  });

  const batch = [
    job({ externalId: "near", title: "Backend developer" }),
    job({ externalId: "far", title: "Backend developer Gothenburg", lat: 57.7089, lon: 11.9746, location: "Göteborg" }),
    job({ externalId: "dup", title: "backend developer", url: "https://example.com/dup" }),
    job({ externalId: "low", title: "Junior tester" }),
    job({ externalId: "boom", title: "Explodes" }),
    job({ source: "jobicy", externalId: "hybrid-abroad", title: "Engineer Berlin", region: "INTL", remote: true, eligibleRegions: "Europe", lat: null, lon: null }),
  ];
  const grade = (j: RawJob) =>
    j.externalId === "low" ? score(30) : j.externalId === "hybrid-abroad" ? score(90, { strictlyRemoteFromSweden: false }) : score(88);

  it("filters before scoring, survives a broken source and a failed score, and emails only strong matches", async () => {
    const f = fakes(batch, grade);
    const stats = await runPipeline(f.deps);

    expect(stats.fetched).toBe(6);
    expect(stats.new).toBe(5); // "dup" collapsed into "near"
    expect(stats.sourceErrors).toEqual(["broken: site down"]);
    expect(f.scoredIds.sort()).toEqual(["boom", "hybrid-abroad", "low", "near"]); // "far" never reached the model
    expect(stats.scored).toBe(3);
    expect(stats.failed).toBe(1);
    expect(f.emailed).toEqual([["jobtech:near"]]);

    const matches = await store.listJobs("matches", 0);
    expect(matches.map((j) => j.id)).toEqual(["jobtech:near", "jobtech:low"]);
    expect((await store.getJob("jobicy:hybrid-abroad"))?.filtered_reason).toBe("not strictly remote from Sweden");
    expect((await store.getJob("jobtech:far"))?.filtered_reason).toBe("outside travel distance");
  });

  it("on the next run skips known jobs, retries the failed one, does not re-email, and passes feedback to scoring", async () => {
    await store.setFeedback("jobtech:low", "down", "too junior");
    const f = fakes([...batch, job({ externalId: "new2", title: "Platform engineer" })], grade);
    const stats = await runPipeline(f.deps);

    expect(stats.new).toBe(1);
    expect(f.scoredIds.sort()).toEqual(["boom", "new2"]);
    expect(f.seenFeedback[0]).toEqual(["down:Junior tester"]);
    expect(f.emailed).toEqual([["jobtech:new2"]]);
    expect((await store.getJob("jobtech:low"))?.status).toBe("dismissed");
  });

  it("stops retrying a job after three failed scoring attempts", async () => {
    const f = fakes(batch, grade);
    await runPipeline(f.deps); // third attempt for "boom"
    f.scoredIds.length = 0;
    await runPipeline(f.deps);
    expect(f.scoredIds).toEqual([]);
  });

  it("respects the per-run scoring cap and leaves the rest pending", async () => {
    const many = Array.from({ length: 5 }, (_, i) => job({ externalId: `cap${i}`, title: `Role ${i}` }));
    const f = fakes(many, grade);
    const stats = await runPipeline({ ...f.deps, maxScored: 2 });
    expect(stats.scored).toBe(2);
    expect(await store.pendingCount()).toBe(3);
  });

  it("aborts on missing credentials without using up the jobs' retries", async () => {
    const f = fakes([], grade);
    f.deps.llm.scoreJob = async () => { throw new LlmConfigError("Put a valid ANTHROPIC_API_KEY in the environment"); };
    await expect(runPipeline(f.deps)).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(await store.pendingCount()).toBe(3);
    expect((await store.lastRun())?.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("keeps what was scored when the free-tier quota runs out, and leaves the rest pending", async () => {
    const f = fakes([], grade);
    let calls = 0;
    f.deps.llm.concurrency = 1;
    f.deps.llm.scoreJob = async () => {
      if (++calls > 1) throw new LlmQuotaError("Gemini free-tier limit reached for today.");
      return score(75);
    };
    const stats = await runPipeline(f.deps);
    expect(stats).toMatchObject({ scored: 1, failed: 0 });
    expect(stats.sourceErrors.join(" | ")).toMatch(/limit reached for today/);
    expect(calls).toBe(2); // stopped after the first refusal
    expect(await store.pendingCount()).toBe(2);
  });

  it("stops starting new scoring calls once the time budget is spent", async () => {
    const f = fakes([], grade);
    const stats = await runPipeline({ ...f.deps, timeBudgetMs: -1 });
    expect(stats.scored).toBe(0);
    expect(f.scoredIds).toEqual([]);
    expect(stats.sourceErrors.join(" | ")).toMatch(/time limit/);
    expect(await store.pendingCount()).toBe(2);
  });

  it("aggregates gaps and tracks status changes", async () => {
    const gaps = await store.gapCounts();
    expect(gaps[0]).toMatchObject({ gap: "Kubernetes" });
    expect(gaps[0].count).toBeGreaterThanOrEqual(3);
    await store.setFeedback("jobtech:near", "up", null);
    await store.setStatus("jobtech:new2", "applied");
    expect((await store.trackedJobs()).map((j) => `${j.id}=${j.status}`).sort()).toEqual(["jobtech:near=saved", "jobtech:new2=applied"]);
  });
});
