"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Submit button that shows progress and blocks double-submits while the
// server action runs.
export function SubmitButton({
  children,
  pendingLabel,
  className = "button button-primary",
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending || undefined}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
