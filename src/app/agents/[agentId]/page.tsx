import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { endSlipAction, pauseAgentAction, renewSlipAction, revokeAgentAction, setShipToAction } from "@/app/actions";
import { ActivityList } from "@/components/activity-list";
import { ApprovalCard } from "@/components/approval-card";
import { cardMarket } from "@/lib/services/market";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SubmitButton } from "@/components/submit-button";
import { isDemoOwner } from "@/lib/demo/account";
import { addressSummary, getAddressForSlip, listAddresses } from "@/lib/services/addresses";
import { orderLink, ordersForPurchases } from "@/lib/services/orders";
import { Notice } from "@/components/notice";
import { Slip } from "@/components/slip";
import { Topbar } from "@/components/topbar";
import { formatUsd } from "@/lib/money";
import { requireOwner } from "@/lib/owner";
import { getAgent } from "@/lib/services/agents";
import { ServiceError } from "@/lib/services/common";
import { recentActivity } from "@/lib/services/overview";
import { getLiveSlip, listSlipHolds, renewalState, rollOverAgentIfDue } from "@/lib/services/slips";
import { listPendingApprovals, listSpendRequestsForOwner } from "@/lib/services/spend";

// A signature reads like a name: the owner's name, or the letters of their
// email before the @ ("austin.john337" -> "Austin John").
function signatureName(name: string | null, email: string): string {
  if (name?.trim()) return name.trim();
  const words = (email.split("@")[0] ?? "").replace(/[^a-zA-Z._-]+/g, " ").split(/[._\s-]+/).filter(Boolean);
  const pretty = words.map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return pretty || "Owner";
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const CATEGORY_LABELS: Record<string, string> = {
  office_supplies: "Office supplies",
  groceries: "Groceries",
  food_and_drink: "Food and drink",
  travel: "Travel",
  software: "Software",
  electronics: "Electronics",
  household: "Household",
  other: "Other",
};
const ORDER_LABEL: Record<string, string> = {
  SENT: "sent to the store",
  SEEN: "confirmed by the store",
  SHIPPED: "shipped",
  CANCELLED: "cancelled - PayPal did not complete the payment",
};

const SPEND_STAMP: Record<string, { cls: string; label: string }> = {
  COMPLETED: { cls: "allow", label: "Paid" },
  PROCESSING: { cls: "ask", label: "Paying" },
  PENDING_APPROVAL: { cls: "ask", label: "Ask you" },
  DENIED: { cls: "deny", label: "Blocked" },
  APPROVAL_EXPIRED: { cls: "deny", label: "Expired" },
  PAYMENT_FAILED: { cls: "deny", label: "Failed" },
};
const HOLD_LABEL: Record<string, string> = {
  AWAITING_APPROVAL: "Waiting for your PayPal approval",
  ACTIVE: "Held",
  RELEASED: "Released",
  EXPIRED: "Expired",
  FAILED: "PayPal could not open this hold",
};

export default async function AgentPage({ params, searchParams }: { params: Promise<{ agentId: string }>; searchParams: Promise<{ notice?: string }> }) {
  const owner = await requireOwner();
  const { agentId } = await params;
  const { notice } = await searchParams;
  if (!z.uuid().safeParse(agentId).success) notFound();
  const agent = await getAgent(owner.id, agentId).catch((e) => {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  });

  // A period that just ended moves to its renewed holds (or the slip expires).
  await rollOverAgentIfDue(agentId);
  const slip = await getLiveSlip(owner.id, agentId);
  const [slipHolds, spends, pending, activity, addresses] = await Promise.all([
    slip ? listSlipHolds(owner.id, slip.id) : Promise.resolve([]),
    listSpendRequestsForOwner(owner.id, agentId),
    listPendingApprovals(owner.id),
    recentActivity(owner.id, agentId, 10),
    listAddresses(owner.id),
  ]);
  const orders = await ordersForPurchases(owner.id, spends.map((s) => s.spend.id));
  const shipTo = slip?.shipToAddressId ? await getAddressForSlip(owner.id, slip.shipToAddressId) : null;
  const demo = isDemoOwner(owner.id);
  const myPending = pending.filter((p) => p.spend.agentId === agentId);
  const period = slip ? slipHolds.filter((h) => h.periodIndex === slip.currentPeriodIndex) : [];
  const spent = period.reduce((s, h) => s + h.capturedCents, 0);
  const revoked = agent.status === "REVOKED";
  const nextHolds = slip ? slipHolds.filter((h) => h.periodIndex === slip.currentPeriodIndex + 1) : [];
  const renewal = slip ? renewalState(slip) : null;
  const periodEnd = slip ? dateFmt.format(slip.currentPeriodEndsAt) : "";
  const renewedNext = nextHolds.length > 0 && nextHolds.every((h) => h.status === "ACTIVE");

  return (
    <>
      <Topbar />
      <main className="page">
        <div className="agent-page rise">
          <Link href="/" className="back-link">
            Your agents
          </Link>
          <Notice code={notice} />

          <header className="section-head">
            <div>
              <h1 className="panel-title">{agent.name}</h1>
              {agent.description ? <p className="panel-text">{agent.description}</p> : null}
            </div>
            <span className={`stamp stamp-${agent.status === "ACTIVE" ? "allow" : agent.status === "PAUSED" ? "ask" : "deny"}`}>
              {agent.status === "ACTIVE" ? "Active" : agent.status === "PAUSED" ? "Paused" : "Revoked"}
            </span>
          </header>

          {!revoked ? (
            <div className="toolbar">
              <ConfirmDialog
                trigger={agent.status === "PAUSED" ? "Resume" : "Pause"}
                title={agent.status === "PAUSED" ? `Resume ${agent.name}?` : `Pause ${agent.name}?`}
                confirmLabel={agent.status === "PAUSED" ? "Resume" : "Pause"}
                pendingLabel={agent.status === "PAUSED" ? "Resuming" : "Pausing"}
                action={pauseAgentAction}
              >
                <p>
                  {agent.status === "PAUSED"
                    ? "It can spend again within its permission slip."
                    : "It cannot spend until you resume it. Its budget holds stay in place."}
                </p>
                <input type="hidden" name="agentId" value={agentId} />
                <input type="hidden" name="paused" value={agent.status === "PAUSED" ? "false" : "true"} />
              </ConfirmDialog>
              <ConfirmDialog
                trigger="Revoke"
                triggerClassName="button button-quiet button-quiet-danger"
                title={`Revoke ${agent.name}?`}
                confirmLabel="Revoke agent"
                pendingLabel="Revoking"
                action={revokeAgentAction}
                tone="danger"
              >
                <p>Its key stops working at once, waiting purchases are declined, and the rest of every budget hold is released. This cannot be undone.</p>
                <input type="hidden" name="agentId" value={agentId} />
              </ConfirmDialog>
            </div>
          ) : null}

          {slip && renewal && !revoked && !renewal.lastPeriod && !renewedNext && (renewal.due || nextHolds.length > 0) ? (
            <section className="renewal" aria-label="Renewal">
              {nextHolds.length === 0 ? (
                <>
                  <div>
                    <p className="renewal-title">This budget period ends {periodEnd}</p>
                    <p className="muted">Renew to keep {agent.name} spending with the same rules. If you do nothing, it stops on {periodEnd} and everything still held is released.</p>
                  </div>
                  <ConfirmDialog
                    trigger="Renew budget"
                    triggerClassName="button button-primary"
                    title="Renew for another period?"
                    confirmLabel="Renew"
                    pendingLabel="Renewing"
                    action={renewSlipAction}
                  >
                    <p>
                      Same rules: {formatUsd(slip.periodBudgetCents)} for {slip.periodDays} days, split across the same stores. You approve the new budget holds in
                      PayPal next. The current period keeps working until {periodEnd}.
                    </p>
                    <input type="hidden" name="slipId" value={slip.id} />
                    <input type="hidden" name="agentId" value={agentId} />
                  </ConfirmDialog>
                </>
              ) : (
                <>
                  <p className="renewal-title">Renewal started - approve the next period&apos;s holds in PayPal</p>
                  <Link href={`/agents/${agentId}/holds`} className="button button-primary">
                    Continue in PayPal
                  </Link>
                </>
              )}
            </section>
          ) : null}

          {myPending.length > 0 ? (
            <section className="panel-stack">
              <h2 className="section-title">Waiting for you</h2>
              {myPending.map((p) => (
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
                  back={`/agents/${agentId}`}
                />
              ))}
            </section>
          ) : null}

          <div className="agent-columns">
            <section className="panel-stack">
              <div className="section-head">
                <h2 className="section-title">Permission slip</h2>
                {renewedNext ? <span className="status-line status-ok">Next period renewed - starts {periodEnd}</span> : null}
              </div>
              {slip ? (
                <>
                  <Slip
                    tag={slip.status === "ACTIVE" ? "Active" : "Waiting for holds"}
                    rows={[
                      { label: "In your words", value: <span className="slip-quote">&ldquo;{slip.sourceText}&rdquo;</span> },
                      { label: "Budget", value: `${formatUsd(slip.periodBudgetCents)} every ${slip.periodDays} days` },
                      { label: "Spent", value: `${formatUsd(spent)} this period, ends ${dateFmt.format(slip.currentPeriodEndsAt)}` },
                      { label: "Per purchase", value: `Up to ${formatUsd(slip.perPurchaseMaxCents)}` },
                      { label: "Ask me above", value: formatUsd(slip.approveAboveCents) },
                      { label: "Categories", value: slip.categories.map((c) => CATEGORY_LABELS[c] ?? c).join(", ") },
                      { label: "Ends", value: slip.expiresAt ? dateFmt.format(slip.expiresAt) : "When you end it" },
                      {
                        label: "Ships to",
                        value: shipTo ? `${shipTo.label} - ${shipTo.recipient}, ${addressSummary(shipTo)}` : "No address - nothing to ship",
                      },
                    ]}
                    signedBy={signatureName(owner.name, owner.email)}
                    signedOn={dateFmt.format(slip.createdAt)}
                  />
                  {!demo ? (
                    <details className="inline-edit">
                      <summary className="button button-quiet">Change where orders ship</summary>
                      <form action={setShipToAction} className="slip panel-stack">
                        <input type="hidden" name="slipId" value={slip.id} />
                        <input type="hidden" name="agentId" value={agentId} />
                        <fieldset className="fieldset">
                          <legend className="field-label">Ship orders to</legend>
                          <div className="check-grid check-grid-wide">
                            {addresses.map((a) => (
                              <label className="check" key={a.id}>
                                <input type="radio" name="addressId" value={a.id} defaultChecked={a.id === slip.shipToAddressId} />
                                <span>
                                  {a.label} <span className="muted">- {addressSummary(a)}</span>
                                </span>
                              </label>
                            ))}
                            <label className="check">
                              <input type="radio" name="addressId" value="" defaultChecked={!slip.shipToAddressId} />
                              <span>No address - nothing to ship</span>
                            </label>
                          </div>
                        </fieldset>
                        <p className="field-help">
                          New orders ship to it. Budget holds already at PayPal keep the address they were opened with.{" "}
                          <Link href={`/addresses?back=/agents/${agentId}`}>Add or edit addresses</Link>
                        </p>
                        <SubmitButton pendingLabel="Saving">Save</SubmitButton>
                      </form>
                    </details>
                  ) : null}
                  <ConfirmDialog
                    trigger="End slip"
                    triggerClassName="button button-quiet button-quiet-danger"
                    title="End this permission slip?"
                    confirmLabel="End slip"
                    pendingLabel="Ending"
                    action={endSlipAction}
                    tone="danger"
                  >
                    <p>The agent stops spending, waiting purchases are declined, and the rest of each budget hold is released at PayPal.</p>
                    <input type="hidden" name="slipId" value={slip.id} />
                    <input type="hidden" name="agentId" value={agentId} />
                  </ConfirmDialog>
                </>
              ) : revoked ? (
                <p className="muted">This agent is revoked.</p>
              ) : (
                <div className="empty">
                  <h2>No permission slip</h2>
                  <p>Without a slip this agent cannot spend anything.</p>
                  <Link href={`/agents/${agentId}/slip`} className="button button-primary empty-action">
                    Write a permission slip
                  </Link>
                </div>
              )}
            </section>

            <section className="panel-stack">
              <h2 className="section-title">Budget holds</h2>
              {period.length === 0 ? (
                <p className="muted">Holds appear here once the slip is co-signed.</p>
              ) : (
                <ul className="hold-list">
                  {period.map((h) => (
                    <li key={h.id} className="hold">
                      <div className="hold-head">
                        <span>
                          {h.storeName} <span className="tag">Demo store (PayPal sandbox)</span>
                        </span>
                        <span className="mono">{formatUsd(h.amountCents)}</span>
                      </div>
                      {h.status === "ACTIVE" ? (
                        <div className="meter" role="img" aria-label={`${formatUsd(h.capturedCents)} of ${formatUsd(h.amountCents)} spent`}>
                          <span style={{ width: `${Math.min(100, (h.capturedCents / h.amountCents) * 100)}%` }} />
                        </div>
                      ) : null}
                      <p className="muted">
                        {HOLD_LABEL[h.status]}
                        {h.status === "ACTIVE" ? ` - ${formatUsd(h.capturedCents)} spent, ${formatUsd(h.amountCents - h.capturedCents - h.reservedCents)} left` : ""}
                      </p>
                      {h.status === "AWAITING_APPROVAL" && h.paypalOrderId ? (
                        <Link href={`/agents/${agentId}/holds`} className="button button-primary">
                          Approve in PayPal
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              <h2 className="section-title">Purchases</h2>
              {spends.length === 0 ? (
                <p className="muted">No purchases yet.</p>
              ) : (
                <ul className="decisions">
                  {spends.map(({ spend, storeName }) => {
                    const stamp = SPEND_STAMP[spend.status] ?? { cls: "ask", label: spend.status };
                    const items = spend.items as { name: string; quantity: number }[];
                    const reasons = (spend.decision as { reasons: { code: string; message: string }[] }).reasons;
                    return (
                      <li className="decision" key={spend.id}>
                        <span className={`stamp stamp-${stamp.cls}`}>{stamp.label}</span>
                        <span>
                          {items.map((i) => `${i.quantity} x ${i.name}`).join(", ")}
                          <span className="decision-why">
                            {storeName}
                            {reasons.length && spend.status !== "COMPLETED" ? ` - ${reasons.map((r) => r.message).join(" ")}` : ""}
                          </span>
                          {orders.get(spend.id) ? (
                            <span className="decision-why">
                              Order: {orders.get(spend.id)!.paymentPending && orders.get(spend.id)!.status !== "CANCELLED" ? "waiting for PayPal to confirm the payment" : ORDER_LABEL[orders.get(spend.id)!.status]}
                              {orders.get(spend.id)!.status !== "CANCELLED" ? (
                                <>
                                  {" - "}
                                  <a href={orderLink(orders.get(spend.id)!.id)} target="_blank" rel="noreferrer">
                                    store&apos;s order page
                                  </a>
                                </>
                              ) : null}
                            </span>
                          ) : null}
                        </span>
                        <span className="decision-amount">{formatUsd(spend.totalCents)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <h2 className="section-title">Activity</h2>
              <ActivityList events={activity} />
              <Link href={`/activity?agent=${agentId}`} className="see-all">
                See all activity for this agent
              </Link>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
