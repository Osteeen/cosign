import Link from "next/link";
import { auth, signOut } from "@/auth";
import { ConfirmDialog } from "./confirm-dialog";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";
import { MainNav } from "./main-nav";
import { demoEnabled, isDemoOwner } from "@/lib/demo/account";
import { DemoButton } from "./demo-button";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export async function Topbar() {
  const session = await auth();
  const email = session?.user?.email;
  return (
    <header className="topbar">
      <Wordmark />
      {email ? <MainNav /> : null}
      <div className="topbar-right">
        <ThemeToggle />
        {email ? (
          <>
            {session?.user?.id && isDemoOwner(session.user.id) ? (
              <span className="tag demo-tag">Demo account</span>
            ) : (
              <span className="topbar-email" title={email}>
                {email}
              </span>
            )}
            <ConfirmDialog trigger="Sign out" title="Sign out of Cosign?" confirmLabel="Sign out" pendingLabel="Signing out" action={signOutAction}>
              <p>Your agents keep working within their permission slips. To sign back in, we will email you a new link.</p>
            </ConfirmDialog>
          </>
        ) : demoEnabled() ? (
          // Judges and visitors start here; owners sign in from the homepage.
          <DemoButton className="button button-primary" label="Try the demo" />
        ) : (
          <Link href="/sign-in" className="button button-quiet">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
