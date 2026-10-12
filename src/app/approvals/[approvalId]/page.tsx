import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { agents, approvals, spendRequests, stores } from "@/db/schema";
import { ApprovalCard } from "@/components/approval-card";
import { cardMarket } from "@/lib/services/market";
import { Notice } from "@/components/notice";
import { Topbar } from "@/components/topbar";
import { formatUsd } from "@/lib/money";
import { requireOwner } from "@/lib/owner";
import { expireApprovals } from "@/lib/services/spend";

const OUTCOME: Record<string, string> = {
  APPROVED: "You approved this purchase.",
  DENIED: "This purchase was declined. Nothing was charged.",
  EXPIRED: "This request expired before anyone decided. Nothing was charged.",
};

// Where the "wants to spend" email lands. Only the owner can open it.
export default async function ApprovalPage({ params, searchParams }: { params: Promise<{ approvalId: string }>; searchParams: Promise<{ notice?: string }> }) {
  const owner = await requireOwner();
  const { approvalId } = await params;
  const { notice } = await searchParams;
  if (!z.uuid().safeParse(approvalId).success) notFound();
  await expireApprovals(owner.id);

  const [row] = await db
    .select({ approval: approvals, spend: spendRequests, agentName: agents.name, storeName: stores.name })
    .from(approvals)
    .innerJoin(spendRequests, eq(spendRequests.id, approvals.spendRequestId))
    .innerJoin(agents, eq(agents.id, spendRequests.agentId))
    .innerJoin(stores, eq(stores.id, spendRequests.storeId))
    .where(and(eq(approvals.id, approvalId), eq(approvals.ownerId, owner.id)));
  if (!row) notFound();
  const { approval, spend } = row;

  return (
    <>
      <Topbar />
      <main className="page">
        <div className="narrow panel-stack rise">
          <Link href="/" className="back-link">
            Your agents
          </Link>
          <Notice code={notice} />
          <h1 className="panel-title">{approval.status === "PENDING" ? "Needs your OK" : "Purchase request"}</h1>
          {approval.status === "PENDING" ? (
            <ApprovalCard
              approvalId={approval.id}
              agentName={row.agentName}
              storeName={row.storeName}
              totalCents={approval.totalCents}
              cartHash={approval.cartHash}
              purpose={spend.purpose}
              items={spend.items as { name: string; quantity: number; unit_amount_cents: number }[]}
              reasons={(spend.decision as { reasons: { code: string; message: string }[] }).reasons}
                market={cardMarket(spend.marketCheck)}
              expiresAt={approval.expiresAt}
              back={`/approvals/${approval.id}`}
            />
          ) : (
            <div className="panel-stack">
              <p className="panel-text">
                {row.agentName} asked to pay {formatUsd(approval.totalCents)} to {row.storeName}. {OUTCOME[approval.status] ?? ""}
                {approval.status === "APPROVED" ? (spend.status === "COMPLETED" ? " PayPal paid the store." : " PayPal did not take the payment, so nothing was charged.") : ""}
              </p>
              <Link href={`/agents/${spend.agentId}`} className="button button-quiet">
                Open {row.agentName}
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
