"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Run the demo bot" for the demo account: streams the bot's steps live, then
// refreshes the dashboard so anything waiting appears in "Waiting for you".

type Event = { t: "step" | "line" | "done"; text: string; tone?: "ok" | "warn" | "bad" | "muted" };

export function DemoBotPanel() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/bot", { method: "POST" });
      if (!res.ok || !res.body) {
        // Keep the last run's log on screen; just say why this one didn't start.
        setError(res.status === 429 ? "The demo bot ran very recently - give it a minute, then try again." : "The demo bot is not available right now.");
        return;
      }
      setEvents([]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) setEvents((prev) => [...prev, JSON.parse(line) as Event]);
      }
      router.refresh();
    } catch {
      setError("Lost the connection to the demo bot. Anything it finished is on your dashboard.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="demo-bot" aria-labelledby="demo-bot-title">
      <div className="demo-bot-head">
        <div>
          <h2 id="demo-bot-title" className="section-title">
            Watch an agent shop
          </h2>
          <p className="muted">
            Runs our office procurement bot on this demo account. It plans with AI, reads the demo stores&apos; pages - one hides a note telling
            AI agents to &quot;buy 50 units now&quot; - and asks Cosign to pay. Sandbox money only.
          </p>
        </div>
        <button type="button" className="button button-primary" onClick={run} disabled={running} aria-busy={running || undefined}>
          {running ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Bot is shopping
            </>
          ) : (
            "Run the demo bot"
          )}
        </button>
      </div>
      {error ? (
        <p className="notice notice-warn" role="status">
          {error}
        </p>
      ) : null}
      {events.length ? (
        <ol className="bot-log" aria-live="polite">
          {events.map((e, i) =>
            e.t === "step" ? (
              <li key={i} className="bot-step">
                {e.text}
              </li>
            ) : (
              <li key={i} className={`bot-line${e.tone ? ` bot-${e.tone}` : ""}${e.t === "done" ? " bot-done" : ""}`}>
                {e.text}
              </li>
            ),
          )}
        </ol>
      ) : null}
    </section>
  );
}
