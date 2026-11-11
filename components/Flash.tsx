export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p className="flash flash-error" role="alert">{error}</p>;
  if (ok) return <p className="flash flash-ok" role="status">{ok}</p>;
  return null;
}

export type Search = Promise<{ [key: string]: string | string[] | undefined }>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
