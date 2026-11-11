import { CircleAlert, CircleCheck } from "lucide-react";

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error)
    return (
      <p className="notice notice-error" role="alert">
        <CircleAlert size={18} aria-hidden="true" />
        <span>{error}</span>
      </p>
    );
  if (ok)
    return (
      <p className="notice notice-ok" role="status">
        <CircleCheck size={18} aria-hidden="true" />
        <span>{ok}</span>
      </p>
    );
  return null;
}

export type Search = Promise<{ [key: string]: string | string[] | undefined }>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
