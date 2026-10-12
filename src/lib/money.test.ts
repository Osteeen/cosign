import { test } from "node:test";
import assert from "node:assert/strict";
import { centsToPayPal, formatUsd, parseDollars, payPalToCents } from "./money.ts";

test("cents to PayPal strings and back are exact", () => {
  assert.equal(centsToPayPal(1234), "12.34");
  assert.equal(centsToPayPal(5), "0.05");
  assert.equal(centsToPayPal(100000), "1000.00");
  assert.equal(payPalToCents("12.34"), 1234);
  assert.equal(payPalToCents("12.3"), 1230);
  assert.equal(payPalToCents("50"), 5000);
  assert.throws(() => centsToPayPal(0), RangeError);
  assert.throws(() => centsToPayPal(1.5), RangeError);
  assert.throws(() => payPalToCents("-1.00"), RangeError);
  assert.throws(() => payPalToCents("1.234"), RangeError);
});

test("owner amounts parse to cents or null", () => {
  assert.equal(parseDollars("200"), 20000);
  assert.equal(parseDollars("$1,250.00"), 125000);
  assert.equal(parseDollars(" 0.5 "), 50);
  assert.equal(parseDollars("12.345"), null);
  assert.equal(parseDollars("-5"), null);
  assert.equal(parseDollars("abc"), null);
});

test("format for display", () => {
  assert.equal(formatUsd(125000), "$1,250.00");
  assert.equal(formatUsd(5), "$0.05");
  assert.equal(formatUsd(-2400), "-$24.00");
});
