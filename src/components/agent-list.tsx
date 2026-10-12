"use client";

import { useId, useState } from "react";
import Link from "next/link";

// The dashboard's agent cards. The server sorts them so anything waiting on the
// owner comes first; this keeps a long list manageable: revoked agents are
// tucked away, a search appears once there are many, and only the first page
// shows until the owner asks for more.

export type AgentCardData = {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "REVOKED";
  meta: string;
  // Something the owner needs to do, if anything.
  note: string | null;
};

const SEARCH_FROM = 9; // show search when there are more than 8 agents
const PAGE = 12;

const STAMP = {
  ACTIVE: { tone: "allow", label: "Active" },
  PAUSED: { tone: "ask", label: "Paused" },
  REVOKED: { tone: "deny", label: "Revoked" },
} as const;

export function AgentList({ agents }: { agents: AgentCardData[] }) {
  const [query, setQuery] = useState("");
  const [showRevoked, setShowRevoked] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const id = useId();

  const revokedCount = agents.filter((a) => a.status === "REVOKED").length;
  const q = query.trim().toLowerCase();
  // A search looks through every agent, revoked included.
  const matching = q ? agents.filter((a) => a.name.toLowerCase().includes(q)) : agents.filter((a) => showRevoked || a.status !== "REVOKED");
  const visible = matching.slice(0, limit);
  const hidden = matching.length - visible.length;

  return (
    <div className="agent-list-wrap">
      {agents.length >= SEARCH_FROM ? (
        <div className="agent-search">
          <label htmlFor={`${id}-q`} className="visually-hidden">
            Find an agent
          </label>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            id={`${id}-q`}
            type="search"
            className="field-input"
            placeholder="Find an agent by name"
            value={query}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
          />
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="muted agent-list-empty" role="status">
          {q ? `No agents match "${query.trim()}".` : "All your agents are revoked."}
        </p>
      ) : (
        <ul className="agent-list" aria-live={q ? "polite" : undefined}>
          {visible.map((a) => (
            <li key={a.id}>
              <Link href={`/agents/${a.id}`} className={`agent-card${a.status === "REVOKED" ? " agent-card-revoked" : ""}`}>
                <span className="agent-card-name">{a.name}</span>
                <span className={`stamp stamp-${STAMP[a.status].tone}`}>{STAMP[a.status].label}</span>
                {a.note ? <span className="agent-card-note">{a.note}</span> : null}
                <span className="agent-card-meta">{a.meta}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 || (!q && revokedCount > 0) ? (
        <div className="agent-list-more">
          {hidden > 0 ? (
            <button type="button" className="button button-quiet" onClick={() => setLimit(limit + PAGE)}>
              Show more ({hidden})
            </button>
          ) : null}
          {!q && revokedCount > 0 ? (
            <button type="button" className="link-button" aria-pressed={showRevoked} onClick={() => setShowRevoked(!showRevoked)}>
              {showRevoked ? "Hide revoked" : `Show revoked (${revokedCount})`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
