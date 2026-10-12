// The Cosign rules engine: deterministic, pure, and the only thing that can say
// ALLOW. The AI intent check runs afterwards and may only make a decision
// stricter (applyIntentCheck). Fails closed: malformed money throws, so the
// caller never charges on bad input.

import type {
  Decision,
  EvaluationInput,
  FinalDecision,
  IntentResult,
  LineItem,
  Reason,
} from "./types.ts";

const MAX_CENTS = 10_000_000; // $100,000: far above any slip; guards overflow.

function assertCents(value: number, field: string, { allowZero = false } = {}): void {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > MAX_CENTS) {
    throw new RangeError(`${field} must be an integer number of cents in range`);
  }
}

export function computeTotalCents(items: readonly LineItem[]): number {
  if (items.length === 0) throw new RangeError("items must not be empty");
  let total = 0;
  for (const [i, item] of items.entries()) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) {
      throw new RangeError(`items[${i}].quantity out of range`);
    }
    assertCents(item.unitAmountCents, `items[${i}].unitAmountCents`);
    total += item.quantity * item.unitAmountCents;
    if (total > MAX_CENTS) throw new RangeError("total out of range");
  }
  return total;
}

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function evaluate(input: EvaluationInput): Decision {
  const { agentStatus, slip, hold, request, now } = input;
  const computedTotalCents = computeTotalCents(request.items);
  assertCents(request.total.amountCents, "total.amountCents");

  const decide = (outcome: Decision["outcome"], reasons: Reason[]): Decision => ({
    outcome,
    reasons,
    ruleVersion: slip?.ruleVersion ?? null,
    computedTotalCents,
  });

  // The agent itself: stop here, nothing else matters.
  if (agentStatus === "REVOKED") return decide("DENY", [{ code: "AGENT_REVOKED", message: "This agent has been revoked." }]);
  if (agentStatus === "PAUSED") return decide("DENY", [{ code: "AGENT_PAUSED", message: "This agent is paused." }]);
  if (!slip || slip.status !== "ACTIVE") {
    return decide("DENY", [{ code: "NO_ACTIVE_SLIP", message: "This agent has no active permission slip." }]);
  }

  const { rules } = slip;
  const deny: Reason[] = [];

  if (rules.expiresAt && now >= rules.expiresAt) {
    deny.push({ code: "SLIP_EXPIRED", message: "The permission slip has expired." });
  } else if (now >= slip.currentPeriodEndsAt) {
    deny.push({ code: "SLIP_EXPIRED", message: "The budget period has ended and has not been renewed." });
  }

  if (request.total.currency !== rules.currency) {
    deny.push({ code: "CURRENCY_MISMATCH", message: `Only ${rules.currency} is allowed.` });
  }
  if (request.total.amountCents !== computedTotalCents) {
    deny.push({ code: "TOTAL_MISMATCH", message: `Total ${usd(request.total.amountCents)} does not match the items (${usd(computedTotalCents)}).` });
  }

  if (!rules.storeIds.includes(request.storeId)) {
    deny.push({ code: "STORE_NOT_ALLOWED", message: "This store is not on the slip." });
  } else if (!hold || hold.status !== "ACTIVE") {
    deny.push({ code: "NO_ACTIVE_HOLD", message: "There is no active budget hold at this store." });
  } else if (computedTotalCents > hold.remainingCents) {
    deny.push({ code: "HOLD_INSUFFICIENT", message: `Only ${usd(Math.max(hold.remainingCents, 0))} is left in this store's hold.` });
  }

  const offCategory = [...new Set(request.items.map((i) => i.category).filter((c) => !rules.categories.includes(c)))];
  if (offCategory.length > 0) {
    deny.push({ code: "CATEGORY_NOT_ALLOWED", message: `Not allowed on this slip: ${offCategory.join(", ")}.` });
  }

  if (computedTotalCents > rules.perPurchaseMaxCents) {
    deny.push({ code: "OVER_PER_PURCHASE_MAX", message: `Over the ${usd(rules.perPurchaseMaxCents)} per-purchase limit.` });
  }
  if (slip.committedThisPeriodCents + computedTotalCents > rules.periodBudgetCents) {
    const left = Math.max(rules.periodBudgetCents - slip.committedThisPeriodCents, 0);
    deny.push({ code: "OVER_PERIOD_BUDGET", message: `Only ${usd(left)} is left in this period's budget.` });
  }

  if (deny.length > 0) return decide("DENY", deny);

  if (computedTotalCents > rules.approveAboveCents) {
    return decide("NEEDS_APPROVAL", [
      { code: "ABOVE_APPROVAL_THRESHOLD", message: `Over ${usd(rules.approveAboveCents)}, so it needs the owner's approval.` },
    ]);
  }
  return decide("ALLOW", []);
}

// The AI intent check can escalate ALLOW to NEEDS_APPROVAL. It can never turn a
// DENY or NEEDS_APPROVAL into anything looser, whatever the model says.
export function applyIntentCheck(decision: Decision, intent: IntentResult): FinalDecision {
  const escalate = decision.outcome === "ALLOW" && intent.verdict === "FLAGGED";
  return {
    ...decision,
    outcome: escalate ? "NEEDS_APPROVAL" : decision.outcome,
    reasons: escalate
      ? [...decision.reasons, { code: "INTENT_FLAGGED", message: intent.summary ?? "The purchase does not match the slip's intent." }]
      : decision.reasons,
    intentCheck: { verdict: intent.verdict, escalated: escalate, summary: intent.summary },
  };
}
