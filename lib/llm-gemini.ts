import { z } from "zod";
import {
  CV_PROMPT, LETTER_SYSTEM, LlmConfigError, LlmQuotaError, ProfileSchema, ScoreSchema,
  jobBlock, letterPrompt, scoringSystem, tidyScore, type Llm,
} from "./llm";

/**
 * Google Gemini through its REST API, intended for the free tier.
 * Free-tier limits are low (a handful of requests per minute, a few hundred per day, per model),
 * so requests are sent one at a time with a pause between them.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const HELP = "Gemini API access is not set up. Create a free key at aistudio.google.com/apikey and put it in GEMINI_API_KEY.";

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string; details?: { "@type"?: string; retryDelay?: string; violations?: { quotaId?: string }[] }[] };
}

export interface GeminiOptions {
  apiKey?: string;
  model?: string;
  /** Minimum time between requests. The default keeps under roughly 12 requests a minute. */
  minIntervalMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export function createGeminiLlm(options: GeminiOptions = {}): Llm {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
  const model = options.model ?? process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
  const minIntervalMs = options.minIntervalMs ?? Number(process.env.GEMINI_MIN_INTERVAL_MS ?? 5000);
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let queue: Promise<unknown> = Promise.resolve();
  let lastStart = 0;

  /** Run requests strictly one after another, spaced out. */
  function paced<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
      const wait = lastStart + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      lastStart = Date.now();
      return task();
    });
    queue = run.catch(() => undefined);
    return run;
  }

  async function generate(parts: Part[], system: string | null, schema: z.ZodType | null): Promise<string> {
    if (!apiKey) throw new LlmConfigError(HELP);
    const generationConfig: Record<string, unknown> = {};
    if (schema) {
      const jsonSchema = { ...z.toJSONSchema(schema) } as Record<string, unknown>;
      delete jsonSchema.$schema;
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseJsonSchema = jsonSchema;
    }
    const body = JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts }],
      generationConfig,
    });

    for (let attempt = 1; ; attempt++) {
      const res = await doFetch(`${BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body,
        signal: AbortSignal.timeout(120_000),
      });
      const data = (await res.json().catch(() => ({}))) as GeminiResponse;

      if (res.ok) {
        const candidate = data.candidates?.[0];
        const text = (candidate?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("").trim();
        if (!text) throw new Error(`Gemini returned no text (${data.promptFeedback?.blockReason ?? candidate?.finishReason ?? "unknown reason"})`);
        return text;
      }

      const msg = data.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403 || (res.status === 400 && /api key/i.test(msg))) {
        throw new LlmConfigError(`${HELP} (Google said: ${msg})`);
      }
      if (res.status === 404) throw new LlmConfigError(`Gemini model "${model}" was not found. Set GEMINI_MODEL to a model your key can use.`);

      const details = data.error?.details ?? [];
      const daily = details.some((d) => d.violations?.some((v) => /PerDay/i.test(v.quotaId ?? "")));
      const retryable = (res.status === 429 && !daily) || res.status === 500 || res.status === 503;
      if (retryable && attempt < 4) {
        const hinted = parseFloat(details.find((d) => d.retryDelay)?.retryDelay ?? "");
        await sleep(Math.min(Number.isFinite(hinted) ? hinted * 1000 + 1000 : 20_000 * attempt, 65_000));
        continue;
      }
      if (res.status === 429) throw new LlmQuotaError(`Gemini free-tier limit reached${daily ? " for today" : ""}.`);
      throw new Error(`Gemini request failed: ${msg}`);
    }
  }

  async function structured<S extends z.ZodType>(parts: Part[], system: string | null, schema: S): Promise<z.infer<S>> {
    const text = await paced(() => generate(parts, system, schema));
    return schema.parse(JSON.parse(text));
  }

  return {
    provider: "Google Gemini",
    concurrency: 1,

    async parseCv(file) {
      const cv: Part =
        file.mediaType === "application/pdf"
          ? { inlineData: { mimeType: "application/pdf", data: file.data.toString("base64") } }
          : { text: `<cv>\n${file.data.toString("utf8")}\n</cv>` };
      return structured([cv, { text: CV_PROMPT }], null, ProfileSchema);
    },

    async scoreJob(ctx, job) {
      const out = await structured([{ text: `Grade this posting.\n\n${jobBlock(job)}` }], scoringSystem(ctx), ScoreSchema);
      return tidyScore(out);
    },

    coverLetter(profile, job, extra) {
      return paced(() => generate([{ text: letterPrompt(profile, job, extra) }], LETTER_SYSTEM, null));
    },
  };
}
