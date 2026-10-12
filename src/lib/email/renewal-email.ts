// "Your agent's budget renews soon" reminder. Links to Cosign, never to PayPal.

import { formatUsd } from "../money.ts";
import { emailLayout } from "./layout.ts";

export function renewalEmail(input: { agentName: string; budgetCents: number; periodDays: number; endsAt: Date; spentCents: number; url: string }) {
  const ends = input.endsAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const subject = `${input.agentName}'s budget ends ${ends} - renew to keep it running`;
  const text = [
    `${input.agentName}'s budget period ends on ${ends}.`,
    `Spent this period: ${formatUsd(input.spentCents)} of ${formatUsd(input.budgetCents)}.`,
    "",
    `To keep it running, renew in Cosign and approve the next ${input.periodDays} days' budget holds in PayPal: ${input.url}`,
    "",
    "If you do nothing, the agent stops spending when the period ends and everything still held is released.",
    "Cosign sandbox - no real money moves.",
  ].join("\n");
  const html = emailLayout({
    preheader: `Renew by ${ends} to keep ${input.agentName} spending within its slip.`,
    header: "Renewal due",
    title: `${input.agentName}'s budget ends ${ends}`,
    intro: "Renew to keep it running for another period with the same rules. You approve the new budget holds in PayPal.",
    rows: [
      ["Spent", `${formatUsd(input.spentCents)} of ${formatUsd(input.budgetCents)}`],
      ["Next period", `${formatUsd(input.budgetCents)} for ${input.periodDays} days`],
      ["Ends", ends],
    ],
    button: { label: "Renew in Cosign", url: input.url },
    footnote: "If you do nothing, the agent stops spending when the period ends and everything still held is released.",
  });
  return { subject, html, text };
}
