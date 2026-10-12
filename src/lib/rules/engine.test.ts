import { test } from "node:test";
import assert from "node:assert/strict";
import { applyIntentCheck, computeTotalCents, evaluate } from "./engine.ts";
import { cartHash } from "./cart-hash.ts";
import type { EvaluationInput, SlipState } from "./types.ts";

const NOW = new Date("2026-11-01T12:00:00Z");
const STORE = "store-paper-co";
const OTHER_STORE = "store-elsewhere";

function slip(overrides: Partial<SlipState> = {}, rules: Partial<SlipState["rules"]> = {}): SlipState {
  return {
    status: "ACTIVE",
    ruleVersion: 3,
    currentPeriodEndsAt: new Date("2026-11-20T00:00:00Z"),
    committedThisPeriodCents: 0,
    ...overrides,
    rules: {
      currency: "USD",
      periodDays: 28,
      periodBudgetCents: 20_000, // $200
      perPurchaseMaxCents: 10_000, // $100
      approveAboveCents: 5_000, // $50
      storeIds: [STORE],
      categories: ["office_supplies", "groceries"],
      expiresAt: null,
      ...rules,
    },
  };
}

function input(cents: number, overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    agentStatus: "ACTIVE",
    slip: slip(),
    hold: { status: "ACTIVE", remainingCents: 10_000 },
    request: {
      storeId: STORE,
      items: [{ name: "Copy paper", category: "office_supplies", quantity: 1, unitAmountCents: cents }],
      total: { amountCents: cents, currency: "USD" },
    },
    now: NOW,
    ...overrides,
  };
}

const codes = (d: { reasons: { code: string }[] }) => d.reasons.map((r) => r.code);

test("allows a small purchase inside every limit", () => {
  const d = evaluate(input(2_400));
  assert.equal(d.outcome, "ALLOW");
  assert.deepEqual(d.reasons, []);
  assert.equal(d.ruleVersion, 3);
});

test("asks the owner above the approval threshold, not at it", () => {
  assert.equal(evaluate(input(5_000)).outcome, "ALLOW");
  const d = evaluate(input(5_001));
  assert.equal(d.outcome, "NEEDS_APPROVAL");
  assert.deepEqual(codes(d), ["ABOVE_APPROVAL_THRESHOLD"]);
});

test("denies over the per-purchase max", () => {
  const d = evaluate(input(10_001, { hold: { status: "ACTIVE", remainingCents: 20_000 } }));
  assert.equal(d.outcome, "DENY");
  assert.ok(codes(d).includes("OVER_PER_PURCHASE_MAX"));
});

test("denies when the period budget would be exceeded, counting reserved spend", () => {
  const d = evaluate(input(2_000, { slip: slip({ committedThisPeriodCents: 19_000 }) }));
  assert.equal(d.outcome, "DENY");
  assert.deepEqual(codes(d), ["OVER_PERIOD_BUDGET"]);
});

test("revoked and paused agents are denied before anything else", () => {
  assert.deepEqual(codes(evaluate(input(100, { agentStatus: "REVOKED" }))), ["AGENT_REVOKED"]);
  assert.deepEqual(codes(evaluate(input(100, { agentStatus: "PAUSED" }))), ["AGENT_PAUSED"]);
});

test("no slip, or a slip that is not active, is denied", () => {
  assert.deepEqual(codes(evaluate(input(100, { slip: null }))), ["NO_ACTIVE_SLIP"]);
  assert.deepEqual(codes(evaluate(input(100, { slip: slip({ status: "AWAITING_HOLDS" }) }))), ["NO_ACTIVE_SLIP"]);
});

test("denies after the slip expires or the period ends without renewal", () => {
  const expired = evaluate(input(100, { slip: slip({}, { expiresAt: new Date("2026-11-01T11:59:59Z") }) }));
  assert.deepEqual(codes(expired), ["SLIP_EXPIRED"]);
  const periodOver = evaluate(input(100, { now: new Date("2026-11-20T00:00:00Z") }));
  assert.deepEqual(codes(periodOver), ["SLIP_EXPIRED"]);
});

test("denies a store not on the slip, even if a hold somehow exists", () => {
  const i = input(100);
  const d = evaluate({ ...i, request: { ...i.request, storeId: OTHER_STORE } });
  assert.deepEqual(codes(d), ["STORE_NOT_ALLOWED"]);
});

test("denies without an active hold, or when the hold is too small", () => {
  assert.deepEqual(codes(evaluate(input(100, { hold: null }))), ["NO_ACTIVE_HOLD"]);
  assert.deepEqual(codes(evaluate(input(100, { hold: { status: "RELEASED", remainingCents: 10_000 } }))), ["NO_ACTIVE_HOLD"]);
  assert.deepEqual(codes(evaluate(input(2_000, { hold: { status: "ACTIVE", remainingCents: 1_999 } }))), ["HOLD_INSUFFICIENT"]);
});

test("denies any off-category item in the cart", () => {
  const i = input(100);
  const d = evaluate({
    ...i,
    request: {
      ...i.request,
      items: [
        { name: "Paper", category: "office_supplies", quantity: 1, unitAmountCents: 100 },
        { name: "Gift card", category: "other", quantity: 1, unitAmountCents: 100 },
      ],
      total: { amountCents: 200, currency: "USD" },
    },
  });
  assert.deepEqual(codes(d), ["CATEGORY_NOT_ALLOWED"]);
});

test("denies when the stated total does not match the items", () => {
  const i = input(1_000);
  const d = evaluate({ ...i, request: { ...i.request, total: { amountCents: 100, currency: "USD" } } });
  assert.deepEqual(codes(d), ["TOTAL_MISMATCH"]);
});

test("lists every failed rule, not just the first", () => {
  const d = evaluate(input(15_000, { hold: { status: "ACTIVE", remainingCents: 1_000 }, slip: slip({ committedThisPeriodCents: 19_000 }) }));
  assert.equal(d.outcome, "DENY");
  assert.deepEqual(codes(d).sort(), ["HOLD_INSUFFICIENT", "OVER_PERIOD_BUDGET", "OVER_PER_PURCHASE_MAX"]);
});

test("the demo attack: 50 units is denied on several rules", () => {
  const i = input(100);
  const d = evaluate({
    ...i,
    request: {
      ...i.request,
      items: [{ name: "Gift card", category: "other", quantity: 50, unitAmountCents: 2_500 }],
      total: { amountCents: 125_000, currency: "USD" },
    },
  });
  assert.equal(d.outcome, "DENY");
  assert.ok(codes(d).includes("CATEGORY_NOT_ALLOWED"));
  assert.ok(codes(d).includes("OVER_PER_PURCHASE_MAX"));
});

test("fails closed on malformed money: fractions, negatives, huge values", () => {
  assert.throws(() => evaluate(input(12.5)), RangeError);
  assert.throws(() => evaluate(input(-100)), RangeError);
  assert.throws(() => evaluate(input(0)), RangeError);
  assert.throws(() => computeTotalCents([{ name: "x", category: "other", quantity: 1000, unitAmountCents: 10_000_000 }]), RangeError);
  assert.throws(() => computeTotalCents([]), RangeError);
});

test("intent check escalates ALLOW but never loosens", () => {
  const flagged = { verdict: "FLAGGED" as const, summary: "Bulk buy does not match 'keep us stocked'." };
  const allow = applyIntentCheck(evaluate(input(2_400)), flagged);
  assert.equal(allow.outcome, "NEEDS_APPROVAL");
  assert.equal(allow.intentCheck.escalated, true);
  assert.ok(codes(allow).includes("INTENT_FLAGGED"));

  const deny = applyIntentCheck(evaluate(input(100, { agentStatus: "PAUSED" })), { verdict: "CLEAR", summary: null });
  assert.equal(deny.outcome, "DENY");
  const needs = applyIntentCheck(evaluate(input(6_000)), { verdict: "CLEAR", summary: null });
  assert.equal(needs.outcome, "NEEDS_APPROVAL");
  assert.equal(needs.intentCheck.escalated, false);
});

test("cart hash changes when anything in the cart changes", () => {
  const base = input(2_400).request;
  const h = cartHash(base);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(cartHash({ ...base }), h);
  assert.notEqual(cartHash({ ...base, storeId: OTHER_STORE }), h);
  assert.notEqual(cartHash({ ...base, total: { amountCents: 2_401, currency: "USD" } }), h);
  const [first] = base.items;
  assert.ok(first);
  assert.notEqual(cartHash({ ...base, items: [{ ...first, quantity: 2 }] }), h);
});
