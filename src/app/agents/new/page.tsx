import Link from "next/link";
import { NewAgentForm } from "@/components/new-agent-form";
import { Topbar } from "@/components/topbar";
import { requireOwner } from "@/lib/owner";
import { appUrl } from "@/lib/services/common";

export default async function NewAgentPage() {
  await requireOwner();
  return (
    <>
      <Topbar />
      <main className="page">
        <div className="narrow panel-stack rise">
          <Link href="/" className="back-link">
            Your agents
          </Link>
          <NewAgentForm appUrl={appUrl()} />
        </div>
      </main>
    </>
  );
}
