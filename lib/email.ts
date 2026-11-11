import { sourceLabel } from "./sources";
import type { JobRow } from "./types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function digestHtml(jobs: JobRow[], appUrl: string | undefined): string {
  const items = jobs
    .map(
      (j) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eee">
<strong>${j.score}</strong> &nbsp; <a href="${esc(j.url)}">${esc(j.title)}</a> — ${esc(j.company)}<br>
<span style="color:#666">${esc(j.location)} · via ${esc(sourceLabel(j.source))}</span><br>
${esc(j.summary ?? "")}</td></tr>`,
    )
    .join("");
  const link = appUrl ? `<p><a href="${esc(appUrl)}">Open the job tool</a></p>` : "";
  return `<div style="font-family:system-ui,sans-serif;max-width:640px"><h2>${jobs.length} new job match${jobs.length === 1 ? "" : "es"}</h2><table style="width:100%;border-collapse:collapse">${items}</table>${link}</div>`;
}

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.DIGEST_TO);

/** Sends the daily digest through Resend. Returns false when email is not configured. */
export async function sendDigest(jobs: JobRow[]): Promise<boolean> {
  if (!emailConfigured() || jobs.length === 0) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.DIGEST_FROM || "Job matches <onboarding@resend.dev>",
      to: [process.env.DIGEST_TO],
      subject: `${jobs.length} new job match${jobs.length === 1 ? "" : "es"} (top score ${jobs[0].score})`,
      html: digestHtml(jobs, process.env.APP_URL),
    }),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status}): ${await res.text()}`);
  return true;
}
