export type Tone = "strong" | "partial" | "weak" | "none";

/** Presentation of a 0-100 match score: 75+ strong, 50-74 partial, below 50 weak. */
export function scoreTone(score: number | null): { tone: Tone; label: string } {
  if (score == null) return { tone: "none", label: "Not graded yet" };
  if (score >= 75) return { tone: "strong", label: "Great fit" };
  if (score >= 50) return { tone: "partial", label: "Worth a look" };
  return { tone: "weak", label: "Long shot" };
}

export function ScoreRing({ score, size = 96, showLabel = true }: { score: number | null; size?: number; showLabel?: boolean }) {
  const { tone, label } = scoreTone(score);
  const stroke = size >= 80 ? 6 : 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - (score ?? 0) / 100);
  return (
    <div className={`score tone-${tone}`}>
      <div
        className={size >= 80 ? "ring" : "ring ring-sm"}
        style={{ width: size, height: size }}
        role="img"
        aria-label={score == null ? label : `Match score ${score} percent: ${label}`}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
          <circle
            className="ring-value"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="ring-number" aria-hidden="true">
          {score ?? "–"}
          {score != null && <small>%</small>}
        </span>
      </div>
      {showLabel && <span className="score-label">{label}</span>}
    </div>
  );
}
