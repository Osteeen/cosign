"use client";

import { useEffect, useId, useState } from "react";
import { agentConnectionAction } from "@/app/actions";
import { CopyButton } from "./copy-button";

// Shown once, right after an agent is added: how to plug the key into the
// agent, and a live line that turns green when the agent first uses it.

type Tab = "claude" | "code";

export function ConnectAgent({ agentId, apiKey, appUrl }: { agentId: string; apiKey: string; appUrl: string }) {
  const [tab, setTab] = useState<Tab>("claude");
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const id = useId();

  // Poll every 3 s for up to 10 minutes, stop once connected.
  useEffect(() => {
    if (connectedAt) return;
    let stopped = false;
    const started = Date.now();
    const tick = async () => {
      if (stopped || Date.now() - started > 10 * 60_000) return;
      try {
        const { connectedAt: at } = await agentConnectionAction(agentId);
        if (at) {
          setConnectedAt(at);
          return;
        }
      } catch {
        // Network blip: try again on the next tick.
      }
      if (!stopped) timer = setTimeout(tick, 3000);
    };
    let timer = setTimeout(tick, 3000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [agentId, connectedAt]);

  const snippets: Record<Tab, { label: string; hint: string; code: string }> = {
    claude: {
      label: "AI assistant / MCP",
      hint: "Run this once in a terminal to connect Cosign to your AI assistant. This command is for Claude Code, but any MCP client works. Your assistant can check its allowance and pay PayPal stores within the permission slip.",
      code: `claude mcp add --transport http cosign ${appUrl}/api/mcp \\\n  --header "Authorization: Bearer ${apiKey}"`,
    },
    code: {
      label: "Your own code",
      hint: "Exchange the key for a 15-minute token, then ask before each purchase. The answer is paid, waiting for the owner, or blocked.",
      code: `# 1. Get a token
curl -s -X POST ${appUrl}/api/v1/agent/token -u "${apiKey}"

# 2. Ask to pay (use a new Idempotency-Key per purchase)
curl -s -X POST ${appUrl}/api/v1/agent/spend-requests \\
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{"store_id":"<merchant id from /api/v1/agent/me>","purpose":"Restock paper",
       "items":[{"name":"Copy paper","category":"office_supplies","quantity":1,"unit_amount_cents":1500}],
       "total":{"amount_cents":1500,"currency":"USD"}}'`,
    },
  };
  const active = snippets[tab];


  return (
    <section className="connect" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="section-title">
        Connect your agent
      </h2>

      <div className="tabs" role="tablist" aria-label="How your agent connects">
        {(Object.keys(snippets) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`${id}-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`${id}-panel`}
            tabIndex={tab === t ? 0 : -1}
            className="tab"
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next = tab === "claude" ? "code" : "claude";
                setTab(next);
                document.getElementById(`${id}-tab-${next}`)?.focus();
              }
            }}
          >
            {snippets[t].label}
          </button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`}>
        <p className="muted">{active.hint}</p>
        <pre className="snippet">
          <code>{active.code}</code>
        </pre>
        <CopyButton key={tab} value={active.code} />
      </div>

      <p className={`connection ${connectedAt ? "connection-ok" : ""}`} role="status" aria-live="polite">
        <span className="connection-dot" aria-hidden="true" />
        {connectedAt
          ? `Connected - first request at ${new Date(connectedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
          : "Waiting for your AI assistant's first request..."}
      </p>
    </section>
  );
}
