// Sends Cosign emails through Resend. Each email carries an idempotency key, so
// a retry (or a repeated trigger) never sends it twice. Failures are reported
// to the caller, never thrown into a money flow.

import "server-only";

export async function sendEmail(input: { to: string; subject: string; html: string; text: string; idempotencyKey: string }): Promise<boolean> {
  const apiKey = process.env.AUTH_RESEND_KEY;
  const from = process.env.AUTH_EMAIL_FROM || "Cosign <onboarding@resend.dev>";
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") return false;
    console.info(`[dev] email to ${input.to}: ${input.subject}`);
    return true;
  }
  const send = () =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey.slice(0, 256) },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
      signal: AbortSignal.timeout(15_000),
    });
  try {
    let res: Response;
    try {
      res = await send();
    } catch {
      res = await send(); // one retry on a network blip
    }
    if (!res.ok) console.error(`[email] Resend refused (HTTP ${res.status})`);
    return res.ok;
  } catch {
    console.error("[email] Resend unreachable");
    return false;
  }
}
