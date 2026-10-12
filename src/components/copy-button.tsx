"use client";

import { useState } from "react";

// Copies text and confirms with a tick for two seconds.
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      className={`button button-quiet copy-button${state === "copied" ? " is-copied" : ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2000);
      }}
    >
      {state === "copied" ? (
        <>
          <svg viewBox="0 0 20 20" aria-hidden="true" className="copy-tick">
            <path d="M4.5 10.5 8.5 14.5 15.5 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied
        </>
      ) : state === "failed" ? (
        "Select and copy it by hand"
      ) : (
        label
      )}
      <span className="visually-hidden" aria-live="polite">
        {state === "copied" ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}
