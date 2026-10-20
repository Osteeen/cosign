import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { SlipForm } from "@/components/slip-form";
import { Topbar } from "@/components/topbar";
import { requireOwner } from "@/lib/owner";
import { getAgent } from "@/lib/services/agents";
import { ServiceError } from "@/lib/services/common";
import { getLiveSlip } from "@/lib/services/slips";
import { listStores } from "@/lib/services/stores";
import { addressSummary, listAddresses } from "@/lib/services/addresses";

export default async function NewSlipPage({ params }: { params: Promise<{ agentId: string }> }) {
  const owner = await requireOwner();
  const { agentId } = await params;
  if (!z.uuid().safeParse(agentId).success) notFound();
  const agent = await getAgent(owner.id, agentId).catch((e) => {
    if (e instanceof ServiceError && e.status === 404) notFound();
    throw e;
  });
  if (agent.status === "REVOKED" || (await getLiveSlip(owner.id, agentId))) redirect(`/agents/${agentId}`);
  const [stores, addresses] = await Promise.all([listStores(), listAddresses(owner.id)]);

  return (
    <>
      <Topbar />
      <main className="page">
        <div className="narrow-wide panel-stack rise">
          <Link href={`/agents/${agentId}`} className="back-link">
            {agent.name}
          </Link>
          <h1 className="panel-title">Permission slip for {agent.name}</h1>
          <p className="panel-text">Set what it may spend and where. Co-sign it, then approve a PayPal budget hold for each store.</p>
          <SlipForm
            agentId={agentId}
            agentName={agent.name}
            stores={stores.map((s) => ({ id: s.id, name: s.name }))}
            addresses={addresses.map((a) => ({ id: a.id, label: a.label, summary: addressSummary(a) }))}
          />
        </div>
      </main>
    </>
  );
}
