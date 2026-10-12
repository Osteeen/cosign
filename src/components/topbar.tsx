import Link from "next/link";
import { auth, signOut } from "@/auth";
import { ConfirmDialog } from "./confirm-dialog";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";
import { MainNav } from "./main-nav";
import { isDemoOwner } from "@/lib/demo/account";

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
        ) : (
          <Link href="/sign-in" className="button button-quiet">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
