import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Notice } from "@/components/notice";
import { Topbar } from "@/components/topbar";
import { formatUsd } from "@/lib/money";
import { requireOwner } from "@/lib/owner";
import { getAgent } from "@/lib/services/agents";
import { ServiceError } from "@/lib/services/common";
import { approvalUrl, getLiveSlip, holdsToApprove } from "@/lib/services/slips";

// Guided approval: after co-signing, the owner approves each store's budget
// hold in PayPal one at a time. PayPal returns here until all are done.
export default async function ApproveHoldsPage({ params, searchParams }: { params: Promise<{ agentId: string }>; searchParams: Promise<{ notice?: string }> }) {
  const owner = await requireOwner();
  const { agentId } = await params;
  const { notice } = await searchParams;
  if (!z.uuid().safeParse(agentId).success) notFound();
  const agent = await getAgent(owner.id, agentId).catch((e) => {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  });
  const slip = await getLiveSlip(owner.id, agentId);
  if (!slip) redirect(`/agents/${agentId}`);

  const { renewal, holds } = await holdsToApprove(owner.id, slip);
  const done = holds.filter((h) => h.status === "ACTIVE").length;
  const next = holds.find((h) => h.status === "AWAITING_APPROVAL" && h.paypalOrderId);
  if (!next && done === holds.length && holds.length > 0) redirect(`/agents/${agentId}?notice=${renewal ? "renewal-approved" : "holds-all-approved"}`);
  const nextStart = slip.currentPeriodEndsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <>
      <Topbar />
      <main className="page">
        <div className="narrow panel-stack rise">
          <Link href={`/agents/${agentId}`} className="back-link">
            {agent.name}
          </Link>
          <Notice code={notice} />
          <p className="section-label">
            Step {Math.min(done + 1, holds.length)} of {holds.length}
          </p>
          <h1 className="panel-title">{renewal ? "Renew the budget" : "Approve the budget holds"}</h1>
          <p className="panel-text">
            {renewal
              ? `These holds fund the next period, starting ${nextStart}. The current period keeps working until then, and its unspent holds are released when the new one starts.`
              : `For each store, PayPal holds that store's share of the budget on your PayPal. Money only moves when ${agent.name} buys something you allowed, and it goes straight to the store.`}
          </p>

          <ol className="steps" aria-label="Budget holds">
            {holds.map((h) => {
              const state = h.status === "ACTIVE" ? "done" : h.id === next?.id ? "current" : h.status === "FAILED" ? "failed" : "waiting";
              return (
                <li key={h.id} className={`step step-${state}`} aria-current={state === "current" ? "step" : undefined}>
                  <span className="step-mark" aria-hidden="true" />
                  <span className="step-body">
                    <span className="step-name">
                      {h.storeName} <span className="tag">Demo store (PayPal sandbox)</span>
                    </span>
                    <span className="step-state">
                      {state === "done" ? "Held" : state === "current" ? "Next" : state === "failed" ? "PayPal could not open this hold" : "Waiting"}
                    </span>
                  </span>
                  <span className="mono">{formatUsd(h.amountCents)}</span>
                </li>
              );
            })}
          </ol>

          {next ? (
            <div className="panel-stack">
              <a href={approvalUrl(next.paypalOrderId!)} className="button button-primary">
                Approve {formatUsd(next.amountCents)} for {next.storeName} in PayPal
              </a>
              <p className="muted">You will sign in to PayPal (sandbox), approve, and come straight back here for the next store.</p>
            </div>
          ) : (
            <p className="notice notice-warn" role="status">
              None of the remaining holds could be opened at PayPal. End this slip and write it again to retry.
            </p>
          )}
          <Link href={`/agents/${agentId}`} className="see-all">
            Finish later
          </Link>
        </div>
      </main>
    </>
  );
}
