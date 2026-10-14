import Link from "next/link";
import { z } from "zod";
import { Topbar } from "@/components/topbar";
import { formatUsd } from "@/lib/money";
import { requireOwner } from "@/lib/owner";
import { listAgents } from "@/lib/services/agents";
import { ACTIVITY_GROUPS, listActivity, type ActivityGroup } from "@/lib/services/overview";

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

// Which stamp an event gets, by its group.
const STAMP: Record<string, { cls: string; label: string }> = {
  PAYMENT_CAPTURED: { cls: "allow", label: "Paid" },
  SPEND_ALLOWED: { cls: "allow", label: "Allowed" },
  SPEND_DENIED: { cls: "deny", label: "Blocked" },
  APPROVAL_REQUESTED: { cls: "ask", label: "Ask you" },
  APPROVAL_GRANTED: { cls: "allow", label: "Approved" },
  APPROVAL_DENIED: { cls: "deny", label: "Declined" },
  PAYMENT_FAILED: { cls: "deny", label: "Failed" },
  PAYMENT_UNCONFIRMED: { cls: "ask", label: "Checking" },
  HOLD_FAILED: { cls: "deny", label: "Failed" },
  HOLD_RELEASE_FAILED: { cls: "ask", label: "Check" },
  PAYMENT_REVERSED: { cls: "deny", label: "Reversed" },
  PAYMENT_NEEDS_REVIEW: { cls: "ask", label: "Check" },
  PAYMENT_REFUNDED: { cls: "ask", label: "Refunded" },
};

type Search = { agent?: string; type?: string; before?: string; after?: string };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Search> }) {
  const owner = await requireOwner();
  const params = await searchParams;
  const agents = await listAgents(owner.id);
  // Filters are pointers only: an agent ID that isn't this owner's simply matches nothing.
  const agentId = z.uuid().safeParse(params.agent).success && agents.some((a) => a.id === params.agent) ? params.agent : undefined;
  const group = params.type && params.type in ACTIVITY_GROUPS ? (params.type as ActivityGroup) : undefined;
  const { events, olderCursor, newerCursor } = await listActivity(owner.id, { agentId, group, before: params.before, after: params.after });

  const href = (next: Partial<Search>) => {
    const q = new URLSearchParams();
    const merged = { agent: agentId, type: group, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/activity?${s}` : "/activity";
  };
  const agentName = agentId ? agents.find((a) => a.id === agentId)?.name : null;

  return (
    <>
      <Topbar />
      <main className="page">
        <div className="activity-page rise">
          <Link href={agentId ? `/agents/${agentId}` : "/"} className="back-link">
            {agentName ?? "Your agents"}
          </Link>
          <h1 className="panel-title">{agentName ? `Activity - ${agentName}` : "All activity"}</h1>
          <p className="panel-text">Every request, decision, payment and change, newest first. The log is permanent: nothing in it can be edited or deleted.</p>

          <nav className="filters" aria-label="Filter activity">
            <div className="chip-row" role="group" aria-label="Type">
              <Link href={href({ type: undefined })} className="chip" aria-current={!group ? "true" : undefined}>
                Everything
              </Link>
              {(Object.keys(ACTIVITY_GROUPS) as ActivityGroup[]).map((g) => (
                <Link key={g} href={href({ type: g })} className="chip" aria-current={group === g ? "true" : undefined}>
                  {ACTIVITY_GROUPS[g].label}
                </Link>
              ))}
            </div>
            {agents.length > 1 ? (
              <div className="chip-row" role="group" aria-label="Agent">
                <Link href={href({ agent: undefined })} className="chip chip-quiet" aria-current={!agentId ? "true" : undefined}>
                  All agents
                </Link>
                {agents.map((a) => (
                  <Link key={a.id} href={href({ agent: a.id })} className="chip chip-quiet" aria-current={agentId === a.id ? "true" : undefined}>
                    {a.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </nav>

          {events.length === 0 ? (
            <div className="empty">
              <h2>Nothing here yet</h2>
              <p>{group || agentId ? "No activity matches these filters." : "Activity appears here as your agents ask, pay and get decisions."}</p>
              {group || agentId ? (
                <Link href="/activity" className="button button-quiet empty-action">
                  Clear filters
                </Link>
              ) : null}
            </div>
          ) : (
            <ol className="ledger">
              {events.map((e) => {
                const stamp = STAMP[e.type];
                return (
                  <li key={e.id} className="ledger-row">
                    <time className="ledger-time" dateTime={e.occurredAt.toISOString()}>
                      {fmt.format(e.occurredAt)}
                    </time>
                    <span className="ledger-stamp">{stamp ? <span className={`stamp stamp-${stamp.cls}`}>{stamp.label}</span> : null}</span>
                    <span className="ledger-what">
                      {e.summary}
                      {e.agentName && !agentId ? <span className="ledger-agent">{e.agentName}</span> : null}
                    </span>
                    <span className="ledger-amount">{e.amountCents != null ? formatUsd(e.amountCents) : ""}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {newerCursor || olderCursor ? (
            <nav className="pager" aria-label="Pages">
              {newerCursor ? (
                <Link href={href({ after: newerCursor, before: undefined })} className="button button-quiet">
                  Newer
                </Link>
              ) : (
                <span />
              )}
              {olderCursor ? (
                <Link href={href({ before: olderCursor, after: undefined })} className="button button-quiet">
                  Older
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      </main>
    </>
  );
}
