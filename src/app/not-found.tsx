import Link from "next/link";
import { Topbar } from "@/components/topbar";

export default function NotFound() {
  return (
    <>
      <Topbar />
    <main className="page">
      <div className="narrow panel-stack rise">
        <h1 className="panel-title">Page not found</h1>
        <p className="panel-text">This page does not exist, or it belongs to a different account.</p>
        <div className="hero-actions">
          <Link href="/" className="button button-primary">
            Go to your agents
          </Link>
        </div>
      </div>
    </main>
    </>
  );
}
