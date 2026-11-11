import { Check, X } from "lucide-react";

/** What matches (filled) and what is missing (outlined), shown before any long text. */
export function Reasons({ strengths, gaps }: { strengths: string[] | null; gaps: string[] | null }) {
  const matches = strengths ?? [];
  const missing = gaps ?? [];
  if (matches.length + missing.length === 0) return null;
  return (
    <ul className="pills" aria-label="Why this score">
      {matches.map((s) => (
        <li key={`m-${s}`} className="pill pill-match">
          <Check size={14} strokeWidth={2.5} aria-hidden="true" />
          <span className="sr-only">Matches: </span>
          {s}
        </li>
      ))}
      {missing.map((g) => (
        <li key={`g-${g}`} className="pill pill-gap">
          <X size={14} strokeWidth={2.5} aria-hidden="true" />
          <span className="sr-only">Missing: </span>
          {g}
        </li>
      ))}
    </ul>
  );
}
