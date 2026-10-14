import type { CSSProperties } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { formatUsd } from "@/lib/money";
import { agentSummaries, recentActivity } from "@/lib/services/overview";
import { listPendingApprovals } from "@/lib/services/spend";
import { ActivityList } from "@/components/activity-list";
import { AgentList, type AgentCardData } from "@/components/agent-list";
import { ApprovalCard } from "@/components/approval-card";
import { cardMarket } from "@/lib/services/market";
import { BulkNotice, Notice } from "@/components/notice";
import { BulkApprovals } from "@/components/bulk-approvals";
import { DemoButton } from "@/components/demo-button";
import { DemoBotPanel } from "@/components/demo-bot-panel";
import { DemoTour, HowItWorks, LandingGuide } from "@/components/landing-guide";
import { demoEnabled, isDemoOwner } from "@/lib/demo/account";
import { Slip } from "@/components/slip";
import { Topbar } from "@/components/topbar";

const exampleRows = [
  { label: "Agent", value: "Office procurement bot" },
  {
    label: "In your words",
    value: <span className="slip-quote">&ldquo;Keep us stocked with paper and coffee. $200 every four weeks, and ask me before anything over $50.&rdquo;</span>,
  },
  { label: "Budget", value: "$200.00 every 28 days" },
  { label: "Per purchase", value: "Up to $100.00" },
  { label: "Ask me above", value: "$50.00" },
  { label: "Stores", value: "Paper Co  $120.00 held\nBean Supply  $80.00 held" },
  { label: "Categories", value: "Office supplies, groceries" },
];

const exampleDecisions = [
  { stamp: "allow", label: "Paid", amount: "$24.00", what: "Coffee beans", why: "Inside every rule" },
  { stamp: "ask", label: "Ask you", amount: "$80.00", what: "Printer toner", why: "Over your $50.00 limit" },
  { stamp: "deny", label: "Blocked", amount: "$1,250.00", what: "50 gift cards", why: "Not an allowed category, over budget" },
] as const;

const delay = (ms: number) => ({ "--d": ms }) as CSSProperties;
const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

export default async function Home({ searchParams }: { searchParams: Promise<{ notice?: string; bulk?: string }> }) {
  const session = await auth();
  const { notice, bulk } = await searchParams;
  const ownerId = session?.user?.id;
  return (
    <>
      <Topbar />
      <main className="page">
        {ownerId ? (
          <Dashboard ownerId={ownerId} notice={notice} bulk={bulk} />
        ) : (
          <>
            <Landing demo={demoEnabled()} />
            <LandingGuide demo={demoEnabled()} />
          </>
        )}
      </main>
    </>
  );
}

function Landing({ demo }: { demo: boolean }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <h1 className="hero-title rise">Your agents spend. You co-sign.</h1>
        <p className="hero-lede rise" style={delay(120)}>
          Give each AI agent a permission slip: a budget, the stores it can use, and what it must ask you about. Cosign checks every
          purchase against it, and PayPal pays the store directly.
        </p>
        <div className="hero-actions rise" style={delay(240)}>
          <Link href="/sign-in" className="button button-primary">
            Sign in to Cosign
          </Link>
          {demo ? <DemoButton /> : <span className="hero-note">No password. We email you a link.</span>}
        </div>
        <div className="rise" style={delay(360)}>
          <HowItWorks />
        </div>
      </div>
      <div className="hero-slip">
        <Slip className="print" tag="Example" rows={exampleRows} signedBy="R. Mensah" signedOn="Nov 2, 2026" />
        <div>
          <p className="section-label decisions-label rise" style={delay(2350)}>
            How its purchases were decided
          </p>
          <ul className="decisions">
            {exampleDecisions.map((d, i) => (
              <li className="decision" key={d.what} style={stagger(i)}>
                <span className={`stamp stamp-${d.stamp}`}>{d.label}</span>
                <span>
                  {d.what}
                  <span className="decision-why">{d.why}</span>
                </span>
                <span className="decision-amount">{d.amount}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// What each card says, and how urgently: things waiting on the owner first,
// then working agents, then paused, then revoked.
function toCards(
  summaries: Awaited<ReturnType<typeof agentSummaries>>,
  pending: Awaited<ReturnType<typeof listPendingApprovals>>,
): AgentCardData[] {
  const waiting = new Map<string, number>();
  for (const p of pending) waiting.set(p.spend.agentId, (waiting.get(p.spend.agentId) ?? 0) + 1);

  const cards = summaries.map(({ agent, slip, spentCents, holdsAwaiting, holdsActive, nextHoldsAwaiting, renewalDue }) => {
    const purchases = waiting.get(agent.id) ?? 0;
    let note: string | null = null;
    let rank: number;
    if (agent.status === "REVOKED") rank = 6;
    else if (purchases > 0) {
      rank = 0;
      note = purchases === 1 ? "1 purchase waiting for your OK" : `${purchases} purchases waiting for your OK`;
    } else if (slip && holdsAwaiting > 0 && holdsActive === 0) {
      rank = 1;
      note = "Approve its budget holds in PayPal";
    } else if (nextHoldsAwaiting > 0) {
      rank = 1;
      note = "Approve next period's budget holds in PayPal";
    } else if (renewalDue) {
      rank = 2;
      note = "Budget period ends soon - renew it";
    } else rank = agent.status === "PAUSED" ? 5 : slip ? 3 : 4;

    return {
      rank,
      card: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        note,
        meta: !slip
          ? "No permission slip"
          : holdsAwaiting > 0 && holdsActive === 0
            ? "Slip co-signed, budget not placed yet"
            : `${formatUsd(spentCents)} of ${formatUsd(slip.periodBudgetCents)} spent this period`,
      },
    };
  });
  // Stable sort keeps newest-first within each rank.
  return cards.sort((a, b) => a.rank - b.rank).map((c) => c.card);
}

async function Dashboard({ ownerId, notice, bulk }: { ownerId: string; notice?: string; bulk?: string }) {
  const [summaries, pending, activity] = await Promise.all([agentSummaries(ownerId), listPendingApprovals(ownerId), recentActivity(ownerId)]);
  return (
    <div className="dashboard rise">
      <Notice code={notice} />
      <BulkNotice value={bulk} />
      {isDemoOwner(ownerId) && demoEnabled() ? (
        <>
          <DemoTour />
          <DemoBotPanel />
        </>
      ) : null}
      {pending.length > 0 ? (
        <section className="panel-stack" aria-labelledby="approvals-title">
          <h2 id="approvals-title" className="section-title">
            Waiting for you <span className="count">{pending.length}</span>
          </h2>
          {pending.length > 1 ? <BulkApprovals count={pending.length} /> : null}
          <div className="approvals">
            {pending.map((p) => (
              <ApprovalCard
                key={p.approval.id}
                approvalId={p.approval.id}
                agentName={p.agentName}
                storeName={p.storeName}
                totalCents={p.approval.totalCents}
                cartHash={p.approval.cartHash}
                purpose={p.spend.purpose}
                items={p.spend.items as { name: string; quantity: number; unit_amount_cents: number }[]}
                reasons={(p.spend.decision as { reasons: { code: string; message: string }[] }).reasons}
                market={cardMarket(p.spend.marketCheck)}
                expiresAt={p.approval.expiresAt}
                selectable={pending.length > 1}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel-stack" aria-labelledby="agents-title">
        <div className="section-head">
          <h1 id="agents-title" className="panel-title">
            Your agents
          </h1>
          <Link href="/agents/new" className="button button-primary">
            Add an agent
          </Link>
        </div>
        {summaries.length === 0 ? (
          <div className="empty">
            <h2>No agents yet</h2>
            <p>Add an agent, give it a permission slip, and it can pay stores within your rules.</p>
          </div>
        ) : (
          <AgentList agents={toCards(summaries, pending)} />
        )}
      </section>

      <section className="panel-stack" aria-labelledby="activity-title">
        <h2 id="activity-title" className="section-title">
          Recent activity
        </h2>
        <ActivityList events={activity} />
        <div className="see-all-row">
          <Link href="/activity" className="see-all">
            See all activity
          </Link>
          <Link href="/spending" className="see-all">
            Spending table
          </Link>
        </div>
      </section>
    </div>
  );
}
