"use client";

import Link from "next/link";
import { useEffect } from "react";

// Shown when something unexpected fails while loading a page. Money actions
// fail closed, so we can say plainly that nothing was charged.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[page error]", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="page">
      <div className="narrow panel-stack rise">
        <h1 className="panel-title">Something went wrong</h1>
        <p className="panel-text">
          This page could not load just now - often due to a brief connection problem. Nothing was charged and your agents&apos; rules are unchanged.
        </p>
        <div className="hero-actions">
          <button type="button" className="button button-primary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="button button-quiet">
            Go to your agents
          </Link>
        </div>
        {error.digest ? <p className="muted">Reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}
