"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  className = "btn",
  name,
  value,
  search,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  name?: string;
  value?: string;
  /** Marks the "search now" button so the page can show its loading state while it runs. */
  search?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      name={name}
      value={value}
      data-pending={pending}
      data-search={search ? "" : undefined}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
