import type { Metadata } from "next";
import Link from "next/link";
import { BulkNotice } from "@/components/notice";
import { Topbar } from "@/components/topbar";
import { SpendingGrid } from "@/components/spending-grid";
import { requireOwner } from "@/lib/owner";
import { listSpending, SPENDING_LIMIT } from "@/lib/services/overview";

export const metadata: Metadata = { title: "Spending - Cosign" };

export default async function SpendingPage({ searchParams }: { searchParams: Promise<{ bulk?: string }> }) {
  const owner = await requireOwner();
  const rows = await listSpending(owner.id);
  const { bulk } = await searchParams;
  return (
    <>
      <Topbar />
      <main className="page page-wide">
        <div className="spending-page rise">
          <Link href="/" className="back-link">
            Your agents
          </Link>
          <BulkNotice value={bulk} />
          <h1 className="panel-title">Spending</h1>
          <p className="panel-text">
            Every purchase your AI assistants asked for and what Cosign did. Sort, filter, and search - totals match your filters.
            {rows.length === SPENDING_LIMIT ? ` Showing the latest ${SPENDING_LIMIT.toLocaleString("en-US")}.` : ""}
          </p>
          <SpendingGrid rows={rows} />
        </div>
      </main>
    </>
  );
}
