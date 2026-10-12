"use client";

// Last resort when the whole layout fails. Plain inline styles: the app's
// stylesheet may not have loaded.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Helvetica, Arial, sans-serif", background: "#eef1f5", color: "#16213a" }}>
        <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 16px" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Cosign could not load</h1>
          <p style={{ margin: "0 0 20px", color: "#4b5672" }}>
            This is usually a brief connection problem. Nothing was charged and your agents&apos; rules are unchanged.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 6, background: "#2343c8", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
