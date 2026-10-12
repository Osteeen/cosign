import Link from "next/link";
import { Topbar } from "@/components/topbar";

export default function CheckEmailPage() {
  return (
    <>
      <Topbar />
      <main className="page">
        <div className="narrow panel-stack">
          <h1 className="panel-title">Check your email</h1>
          <p className="panel-text">
            We sent you a sign-in link. It works once and expires in 15 minutes. If it is not in your inbox, check spam.
          </p>
          <p className="panel-text">
            Wrong address? <Link href="/sign-in">Send a new link</Link>.
          </p>
        </div>
      </main>
    </>
  );
}
