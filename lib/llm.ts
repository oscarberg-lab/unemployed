import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { FeedbackExample, JobScore, Preferences, Profile, RawJob } from "./types";

/** Override with LLM_MODEL (e.g. a smaller model to cut the daily scoring cost). */
const MODEL = process.env.LLM_MODEL ?? "claude-opus-5-5";
// If the model declines a request, the API retries it once on its default fallback model.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export interface CvFile {
  filename: string;
  mediaType: string;
  data: Buffer;
}

export interface ScoringContext {
  profile: Profile;
  prefs: Preferences;
  feedback: FeedbackExample[];
}

export interface Llm {
  /** Shown in the UI so it is clear where the CV is sent. */
  provider?: string;
  /** How many jobs may be scored at once (free tiers allow very few requests per minute). */
  concurrency?: number;
  parseCv(file: CvFile): Promise<Profile>;
  scoreJob(ctx: ScoringContext, job: RawJob): Promise<JobScore>;
  coverLetter(profile: Profile, job: RawJob, extra: string): Promise<string>;
}

export const ProfileSchema = z.object({
  name: z.string(),
  headline: z.string().describe("One line, e.g. 'Backend developer, 4 years, fintech'"),
  seniority: z.enum(["student", "junior", "mid", "senior", "lead", "executive"]),
  yearsExperience: z.number().describe("Years of relevant professional experience"),
  skills: z.array(z.string()),
  languages: z.array(z.object({ language: z.string(), level: z.string() })),
  education: z.array(z.string()),
  experience: z.array(z.object({ title: z.string(), company: z.string(), period: z.string(), summary: z.string() })),
  searchTerms: z
    .array(z.string())
    .describe("5-8 job titles to search Swedish job boards for, mixing Swedish and English, e.g. 'systemutvecklare', 'backend developer'"),
  summary: z.string().describe("3-5 sentences covering strengths, domain experience and what roles fit"),
});

export const ScoreSchema = z.object({
  score: z.number().describe("Overall fit, integer 0-100"),
  subscores: z.object({
    skills: z.number().describe("0-100"),
    seniority: z.number().describe("0-100"),
    location: z.number().describe("0-100"),
    preferences: z.number().describe("0-100"),
  }),
  summary: z.string().describe("Two sentences, in English, on why this does or does not fit"),
  strengths: z.array(z.string()).describe("Up to 4 short reasons the candidate fits"),
  gaps: z
    .array(z.string())
    .describe("Up to 5 requirements the candidate lacks, each a canonical 1-3 word English skill or qualification name, e.g. 'Kubernetes', 'Swedish fluency', 'Team lead experience'"),
  workMode: z.enum(["onsite", "hybrid", "remote", "unknown"]),
  strictlyRemoteFromSweden: z
    .boolean()
    .describe("True only if the role is fully remote with no on-location requirement AND can be done by someone living in Sweden"),
});

const SCORING_RULES = `You grade job postings for one job seeker. For each posting, judge how well it fits them and return the structured result.

Scoring scale for the overall score:
- 85-100: excellent fit, should apply now
- 70-84: strong fit with minor gaps
- 50-69: a stretch, real gaps but plausible
- 0-49: poor fit

Sub-scores:
- skills: overlap between what the posting requires and what the candidate has actually done.
- seniority: whether the level asked for matches the candidate's level. Penalise both clearly over-senior and clearly under-senior roles.
- location: commute and work mode against the candidate's places and accepted work modes. Fully remote roles score high if remote is accepted.
- preferences: salary (only when the posting states one), contract type, industries to avoid, and the candidate's free-text notes.

Rules:
- Requirements the posting marks as mandatory that the candidate lacks (a language, a licence, a degree, a citizenship or security clearance) should pull the overall score down hard.
- A posting in an industry the candidate wants to avoid scores below 40 overall.
- Be calibrated, not generous: most postings are not a 70+.
- The candidate's past feedback shows their taste. Weigh it, especially the notes.
- Postings may be in Swedish or English. Always answer in English.`;

export function scoringSystem(ctx: ScoringContext): string {
  const { profile, prefs, feedback } = ctx;
  const liked = feedback.filter((f) => f.feedback === "up");
  const disliked = feedback.filter((f) => f.feedback === "down");
  const line = (f: FeedbackExample) => `- ${f.title} at ${f.company}${f.note ? ` (note: ${f.note})` : ""}`;
  return [
    SCORING_RULES,
    `## Candidate (extracted from their CV)\n${JSON.stringify(profile, null, 2)}`,
    `## Preferences
- Places they can work on location: ${prefs.places.map((p) => `${p.name} (within ${p.radiusKm} km)`).join(", ") || "anywhere in Sweden"}
- Accepted work modes: ${prefs.workModes.join(", ") || "any"}
- Minimum monthly salary: ${prefs.minSalarySek ? `${prefs.minSalarySek} SEK` : "not specified"}
- Working hours: ${prefs.workingHours.join(", ") || "any"}
- Contract types: ${prefs.contractTypes.join(", ") || "any"}
- Industries to avoid: ${prefs.avoidIndustries.join(", ") || "none"}
- Other notes from the candidate: ${prefs.notes || "none"}`,
    `## Past feedback
Jobs they marked as interesting:\n${liked.map(line).join("\n") || "- none yet"}
Jobs they marked as not interesting:\n${disliked.map(line).join("\n") || "- none yet"}`,
  ].join("\n\n");
}

export function jobBlock(job: RawJob): string {
  return `Title: ${job.title}
Employer: ${job.company}
Location: ${job.location}${job.eligibleRegions ? `\nOpen to candidates in: ${job.eligibleRegions}` : ""}
Listed as remote by the job board: ${job.remote ? "yes" : "no"}
Working hours: ${job.workingHours ?? "not stated"}
Contract: ${job.contractType ?? "not stated"}
Salary: ${job.salary ?? "not stated"}

${job.description}`;
}

/** Missing or rejected credentials: retrying job by job is pointless, the whole run should stop. */
export class LlmConfigError extends Error {}

/** The provider's usage limit is used up for now. Remaining jobs should wait for the next run. */
export class LlmQuotaError extends Error {}

export const isConfigError = (err: unknown) => err instanceof LlmConfigError;

const CONFIG_HELP = "Claude API access is not set up. Put a valid ANTHROPIC_API_KEY in the environment and try again.";

function asConfigError(err: unknown): unknown {
  const rejected = err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError;
  // With no credentials at all the SDK fails before sending anything, so it is not an API error.
  const missing = !(err instanceof Anthropic.APIError) && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN;
  return rejected || missing ? new LlmConfigError(CONFIG_HELP, { cause: err }) : err;
}

function guarded(llm: Llm): Llm {
  const wrap = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => (...args: A) =>
    fn(...args).catch((err) => { throw asConfigError(err); });
  return { ...llm, parseCv: wrap(llm.parseCv), scoreJob: wrap(llm.scoreJob), coverLetter: wrap(llm.coverLetter) };
}

export const CV_PROMPT =
  "This is my CV. Extract my profile for a job-matching tool that searches the Swedish job market. Only include what the CV supports; judge seniority from the roles and years, not from job titles alone.";

export const LETTER_SYSTEM =
  "You write cover letters for a job seeker. Write in the language of the job posting. Keep it under 300 words, specific to this employer and role, grounded only in facts from the candidate profile, never inventing experience. No placeholders and no flattery clichés. Output only the letter text.";

export const letterPrompt = (profile: Profile, job: RawJob, extra: string) =>
  `## My profile\n${JSON.stringify(profile, null, 2)}\n\n## The posting\n${jobBlock(job)}${extra ? `\n\n## What I want the letter to emphasise\n${extra}` : ""}`;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Clamp and tidy whatever the model returned. */
export function tidyScore(out: z.infer<typeof ScoreSchema>): JobScore {
  return {
    ...out,
    score: clamp(out.score),
    subscores: {
      skills: clamp(out.subscores.skills),
      seniority: clamp(out.subscores.seniority),
      location: clamp(out.subscores.location),
      preferences: clamp(out.subscores.preferences),
    },
    strengths: [...new Set(out.strengths)].slice(0, 4),
    gaps: [...new Set(out.gaps.map((g) => g.trim()).filter(Boolean))].slice(0, 5),
  };
}

export function createAnthropicLlm(client: Anthropic = new Anthropic()): Llm {
  return guarded({
    provider: "Claude (Anthropic)",
    concurrency: 4,
    async parseCv(file) {
      const isPdf = file.mediaType === "application/pdf";
      const cv: Anthropic.Beta.BetaContentBlockParam = isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.data.toString("base64") } }
        : { type: "text", text: `<cv>\n${file.data.toString("utf8")}\n</cv>` };
      const res = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        ...FALLBACK,
        output_config: { effort: "medium", format: zodOutputFormat(ProfileSchema) },
        messages: [
          {
            role: "user",
            content: [
              cv,
              {
                type: "text",
                text: CV_PROMPT,
              },
            ],
          },
        ],
      });
      if (!res.parsed_output) throw new Error(`Could not read the CV (stop reason: ${res.stop_reason})`);
      return res.parsed_output;
    },

    async scoreJob(ctx, job) {
      const res = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 4000,
        ...FALLBACK,
        output_config: { effort: "low", format: zodOutputFormat(ScoreSchema) },
        // Identical for every job in a run, so it is cached after the first call.
        system: [{ type: "text", text: scoringSystem(ctx), cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: `Grade this posting.\n\n${jobBlock(job)}` }],
      });
      const out = res.parsed_output;
      if (!out) throw new Error(`No score returned (stop reason: ${res.stop_reason})`);
      return tidyScore(out);
    },

    async coverLetter(profile, job, extra) {
      const res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        ...FALLBACK,
        output_config: { effort: "medium" },
        system: LETTER_SYSTEM,
        messages: [{ role: "user", content: letterPrompt(profile, job, extra) }],
      });
      if (res.stop_reason === "refusal") throw new Error("The model declined to write this letter.");
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
      if (!text) throw new Error(`No letter returned (stop reason: ${res.stop_reason})`);
      return text;
    },
  });
}
