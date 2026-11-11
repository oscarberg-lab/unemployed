import { describe, expect, it } from "vitest";
import { LlmConfigError, LlmQuotaError } from "@/lib/llm";
import { createGeminiLlm } from "@/lib/llm-gemini";
import { job, prefs, PROFILE } from "./helpers";

const SCORE = {
  score: 140,
  subscores: { skills: 80, seniority: 70, location: 90, preferences: 60 },
  summary: "Good fit.",
  strengths: ["TypeScript"],
  gaps: ["Kubernetes", "Kubernetes ", "AWS"],
  workMode: "hybrid",
  strictlyRemoteFromSweden: false,
};
const ok = (text: string, extraParts: object[] = []) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [...extraParts, { text }] }, finishReason: "STOP" }] }), { status: 200 });
const fail = (status: number, error: object) => new Response(JSON.stringify({ error }), { status });

interface Body {
  systemInstruction: { parts: { text: string }[] };
  contents: { parts: { text: string; inlineData?: object }[] }[];
  generationConfig: { responseMimeType: string; responseJsonSchema: { required: string[]; $schema?: string } };
}

function setup(responses: Response[], apiKey = "test-key") {
  const calls: { url: string; headers: Record<string, string>; body: Body }[] = [];
  const sleeps: number[] = [];
  const llm = createGeminiLlm({
    apiKey,
    model: "test-model",
    minIntervalMs: 0,
    sleep: async (ms) => void sleeps.push(ms),
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
      return responses.shift() ?? fail(500, { message: "no more responses" });
    }) as typeof fetch,
  });
  return { llm, calls, sleeps };
}
const ctx = { profile: PROFILE, prefs: prefs(), feedback: [] };

describe("Gemini provider", () => {
  it("sends the candidate as system instruction, asks for schema-bound JSON, and tidies the result", async () => {
    const { llm, calls } = setup([ok(JSON.stringify(SCORE), [{ text: "thinking...", thought: true }])]);
    const result = await llm.scoreJob(ctx, job());

    expect(calls[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent");
    expect(calls[0].headers["x-goog-api-key"]).toBe("test-key");
    expect(calls[0].body.systemInstruction.parts[0].text).toContain("Test Person");
    expect(calls[0].body.contents[0].parts[0].text).toContain("Backend developer");
    expect(calls[0].body.generationConfig.responseMimeType).toBe("application/json");
    expect(calls[0].body.generationConfig.responseJsonSchema.required).toContain("strictlyRemoteFromSweden");
    expect(calls[0].body.generationConfig.responseJsonSchema.$schema).toBeUndefined();
    expect(result.score).toBe(100); // clamped
    expect(result.gaps).toEqual(["Kubernetes", "AWS"]); // de-duplicated
  });

  it("sends a PDF CV inline and parses the profile", async () => {
    const { llm, calls } = setup([ok(JSON.stringify(PROFILE))]);
    const profile = await llm.parseCv({ filename: "cv.pdf", mediaType: "application/pdf", data: Buffer.from("%PDF-fake") });
    expect(calls[0].body.contents[0].parts[0].inlineData).toEqual({ mimeType: "application/pdf", data: Buffer.from("%PDF-fake").toString("base64") });
    expect(profile.seniority).toBe("mid");
  });

  it("rejects output that does not match the schema", async () => {
    const { llm } = setup([ok(JSON.stringify({ score: "high" }))]);
    await expect(llm.scoreJob(ctx, job())).rejects.toThrow();
  });

  it("waits and retries when the per-minute limit is hit", async () => {
    const perMinute = fail(429, { status: "RESOURCE_EXHAUSTED", message: "quota", details: [{ retryDelay: "12s" }] });
    const { llm, calls, sleeps } = setup([perMinute, ok("Dear team")]);
    expect(await llm.coverLetter(PROFILE, job(), "")).toBe("Dear team");
    expect(calls).toHaveLength(2);
    expect(sleeps).toContain(13_000);
  });

  it("gives up at once on the daily limit, and after retries on a persistent one", async () => {
    const daily = fail(429, { message: "quota", details: [{ violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] }] });
    const a = setup([daily]);
    await expect(a.llm.scoreJob(ctx, job())).rejects.toThrow(LlmQuotaError);
    expect(a.calls).toHaveLength(1);

    const b = setup([1, 2, 3, 4].map(() => fail(429, { message: "quota" })));
    await expect(b.llm.scoreJob(ctx, job())).rejects.toThrow(LlmQuotaError);
    expect(b.calls).toHaveLength(4);
  });

  it("falls back to the default model when GEMINI_MODEL is set but empty, as CI does for unset variables", async () => {
    process.env.GEMINI_MODEL = "";
    const urls: string[] = [];
    const llm = createGeminiLlm({
      apiKey: "k",
      minIntervalMs: 0,
      fetch: (async (url: string) => (urls.push(url), ok("Dear team"))) as typeof fetch,
    });
    await llm.coverLetter(PROFILE, job(), "");
    delete process.env.GEMINI_MODEL;
    expect(urls[0]).toContain("/models/gemini-flash-lite-latest:generateContent");
  });

  it("reports a missing or rejected key as a configuration problem", async () => {
    await expect(setup([], "").llm.scoreJob(ctx, job())).rejects.toThrow(LlmConfigError);
    const bad = setup([fail(400, { message: "API key not valid. Please pass a valid API key." })]);
    await expect(bad.llm.scoreJob(ctx, job())).rejects.toThrow(/GEMINI_API_KEY/);
  });
});
