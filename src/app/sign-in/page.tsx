import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, signIn } from "@/auth";
import { rateLimit, clientIp } from "@/lib/api";
import { SubmitButton } from "@/components/submit-button";
import { Topbar } from "@/components/topbar";
import { DemoButton } from "@/components/demo-button";
import { demoEnabled } from "@/lib/demo/account";

const Email = z.email().max(254);

// Only same-site paths: never an absolute URL or protocol-relative "//host".
function safeNext(value: unknown): string {
  const v = typeof value === "string" ? value : "";
  return /^\/(?!\/)[\w\-./?=&%]*$/.test(v) ? v : "/";
}

async function sendLink(formData: FormData) {
  "use server";
  const parsed = Email.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  const next = safeNext(formData.get("next"));
  if (!parsed.success) redirect(`/sign-in?error=email&next=${encodeURIComponent(next)}`);
  // Stop sign-in email floods: per address (someone else's inbox) and per sender.
  const ip = clientIp(await headers());
  const perEmail = rateLimit(`signin-email:${parsed.data}`, 3, 15 * 60_000);
  const perIp = rateLimit(`signin-ip:${ip}`, 10, 60 * 60_000);
  if (!perEmail.ok || !perIp.ok) redirect(`/sign-in?error=slow&next=${encodeURIComponent(next)}`);
  await signIn("resend", { email: parsed.data, redirectTo: next });
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; reason?: string }> }) {
  const { error, next: rawNext, reason } = await searchParams;
  const next = safeNext(rawNext);
  if (await auth()) redirect(next);
  return (
    <>
      <Topbar />
      <main className="page">
        <div className="narrow panel-stack rise">
          <h1 className="panel-title">Sign in to Cosign</h1>
          {reason === "hold" ? (
            <p className="notice notice-warn" role="status">
              PayPal approved your budget hold. Sign in to finish switching it on - nothing is held until you do.
            </p>
          ) : null}
          <p className="panel-text">Enter your email and we will send you a one-time sign-in link. No password needed.</p>
          <form action={sendLink} className="slip panel-stack" noValidate>
            <input type="hidden" name="next" value={next} />
            <div className="field">
              <label htmlFor="email" className="field-label">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                className="field-input"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={254}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "email-error" : undefined}
              />
              {error ? (
                <p id="email-error" className="field-error" role="alert">
                  {error === "email"
                    ? "Enter a full email address, like name@company.com."
                    : error === "demo"
                      ? "The demo account isn't set up on this server yet."
                      : error === "slow"
                      ? "Too many sign-in emails for now. Use the newest link we sent, or wait a few minutes and try again."
                      : error === "Verification"
                      ? "That sign-in link has expired or was already used. Send yourself a new one."
                      : "We could not send your sign-in email just now. Check your connection and try again."}
                </p>
              ) : null}
            </div>
            <SubmitButton pendingLabel="Sending link">Email me a sign-in link</SubmitButton>
          </form>
          {demoEnabled() ? (
            <div className="demo-entry">
              <p className="panel-text">Judging or just looking? Open the shared demo account - sandbox money only, nothing to set up.</p>
              <DemoButton />
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
