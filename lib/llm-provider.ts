import { createAnthropicLlm, type Llm } from "./llm";
import { createGeminiLlm } from "./llm-gemini";

export type Provider = "gemini" | "anthropic";

/**
 * Which model service reads the CV and grades jobs.
 * LLM_PROVIDER decides; without it, whichever key is present wins (Claude if both are).
 */
export function activeProvider(): Provider {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === "gemini" || explicit === "anthropic") return explicit;
  return process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY ? "gemini" : "anthropic";
}

export const providerLabel = () => (activeProvider() === "gemini" ? "Google Gemini (free tier)" : "Claude (Anthropic)");

export function getLlm(): Llm {
  return activeProvider() === "gemini" ? createGeminiLlm() : createAnthropicLlm();
}
