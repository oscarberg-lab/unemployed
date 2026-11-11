const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Turn feed HTML into readable plain text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li|\/ul|\/ol)\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(ab|aktiebolag|inc|ltd|llc|gmbh|sweden|sverige)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Same job posted on several sites -> same key. Location keeps one employer's identical roles in different towns apart. */
export function dedupeKey(job: { title: string; company: string; region: string; location: string }): string {
  return `${normalize(job.company)}|${normalize(job.title)}|${job.region === "SE" ? normalize(job.location) : ""}`;
}
