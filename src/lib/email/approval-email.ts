// "Your agent wants to spend" email. It links to Cosign, never straight to
// PayPal, so a look-alike email cannot trick anyone into approving at PayPal.

import { formatUsd } from "../money.ts";
import { emailLayout } from "./layout.ts";
import { withoutLinks } from "@/lib/ai/untrusted";

export function approvalEmail(input: {
  agentName: string;
  storeName: string;
  totalCents: number;
  items: { name: string; quantity: number }[];
  purpose: string;
  reasons: { code: string; message: string }[];
  // Channel3 market prices, e.g. "About market price - walmart.com $16.07".
  market?: string | null;
  expiresAt: Date;
  url: string;
}) {
  const amount = formatUsd(input.totalCents);
  // Agent-written text: links removed, so the email can't carry a phishing link.
  const what = withoutLinks(input.items.map((i) => `${i.quantity} x ${i.name}`).join(", "));
  const purpose = withoutLinks(input.purpose);
  const expires = input.expiresAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const flagged = input.reasons.some((r) => r.code === "INTENT_FLAGGED");
  const why = input.reasons.map((r) => r.message).join(" ");
  const subject = flagged
    ? `Check this: ${input.agentName} wants to pay ${amount} - flagged`
    : `${input.agentName} wants to pay ${amount} - approve or decline`;
  const text = [
    `${input.agentName} wants to pay ${amount} to ${input.storeName}.`,
    "",
    `What: ${what}`,
    `Why Cosign is asking: ${flagged ? "Flagged by purchase check. " : ""}${why}`,
    `The agent said: "${purpose}"`,
    ...(input.market ? [`Market (Channel3): ${input.market}`] : []),
    `Decide by: ${expires}`,
    "",
    `Approve or decline in Cosign: ${input.url}`,
    "",
    "If you do nothing, nothing is charged and the amount goes back into the budget.",
    "Cosign sandbox - no real money moves.",
  ].join("\n");
  const html = emailLayout({
    preheader: `${input.agentName} is asking before it pays ${amount} to ${input.storeName}.`,
    header: "Waiting for your OK",
    title: `${input.agentName} wants to pay ${amount}`,
    intro: flagged
      ? "Cosign's purchase check flagged this. It is waiting for you. Only approve it if you expected it."
      : input.reasons.some((r) => r.code === "ABOVE_APPROVAL_THRESHOLD")
        ? `It is over your "ask me above" limit, so it is waiting for you.`
        : "Cosign is checking with you before it pays, so it is waiting for you.",
    rows: [
      ["Store", `${input.storeName} - Demo store (PayPal sandbox)`],
      ["What", what],
      ["Why asking", why],
      ["Agent said", `"${purpose}"`],
      ...(input.market ? ([["Market", `${input.market} (Channel3)`]] as [string, string][]) : []),
      ["Decide by", expires],
    ],
    button: { label: "Review in Cosign", url: input.url },
    footnote: "If you do nothing, nothing is charged and the amount goes back into the budget.",
  });
  return { subject, html, text };
}
