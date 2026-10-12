// Owner sign-in: Auth.js with an emailed one-time link sent through Resend.
// Sessions live in the database, so signing out or revoking a session takes
// effect at once. Agents never use this; they authenticate with API keys.

import { createHash } from "node:crypto";
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db/client.ts";
import { accounts, sessions, users, verificationTokens } from "./db/schema.ts";
import { signInEmail } from "./lib/email/sign-in-email.ts";

const LINK_LIFETIME_SECONDS = 15 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database", maxAge: 7 * 24 * 60 * 60 },
  callbacks: {
    // Expose the owner ID (from the database session, never from the client).
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  // Errors land on our sign-in page with a plain message, not Auth.js's default page.
  pages: { verifyRequest: "/sign-in/check-email", error: "/sign-in" },
  providers: [
    Resend({
      // || not ??: an empty AUTH_EMAIL_FROM= line must fall back too.
      from: process.env.AUTH_EMAIL_FROM || "Cosign <onboarding@resend.dev>",
      maxAge: LINK_LIFETIME_SECONDS,
      async sendVerificationRequest({ identifier: to, url, provider }) {
        const apiKey = provider.apiKey;
        if (!apiKey) {
          // Local development only: no email service, so print the link.
          if (process.env.NODE_ENV === "production") throw new Error("AUTH_RESEND_KEY is not set");
          console.info(`[dev] Cosign sign-in link for ${to}: ${url}`);
          return;
        }
        const { subject, html, text } = signInEmail(url, to);
        // Resend de-duplicates on this key, so the retry below never sends two emails.
        const idempotencyKey = createHash("sha256").update(url).digest("hex").slice(0, 40);
        const send = () =>
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
            body: JSON.stringify({ from: provider.from, to, subject, html, text }),
            signal: AbortSignal.timeout(15_000),
          });
        let res: Response;
        try {
          res = await send();
        } catch {
          // Network blip (common on mobile hotspots): try once more.
          res = await send();
        }
        if (!res.ok) {
          // Log status only; the response body can echo the recipient.
          throw new Error(`Resend refused the sign-in email (HTTP ${res.status})`);
        }
      },
    }),
  ],
});
