import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renewAgainAt } from "./reauth-policy.ts";

const now = new Date("2026-10-19T12:18:00Z");
const expires = new Date("2026-11-10T09:33:00Z");
const hours = (d: Date | null) => (d ? (d.getTime() - now.getTime()) / 3_600_000 : null);

describe("renewing a hold after PayPal refuses", () => {
  it("waits 6 hours when PayPal says it is too soon", () => {
    assert.equal(hours(renewAgainAt({ issue: "REAUTHORIZATION_TOO_SOON", definite: true }, now, expires)), 6);
  });

  it("never asks again once PayPal says a second renewal is not supported", () => {
    assert.deepEqual(renewAgainAt({ issue: "REAUTHORIZATION_NOT_SUPPORTED", definite: true }, now, expires), expires);
  });

  it("still stops for the hold's lifetime when its expiry is unknown", () => {
    assert.equal(hours(renewAgainAt({ issue: "REAUTHORIZATION_NOT_SUPPORTED", definite: true }, now, null)), 29 * 24);
  });

  it("backs off a day after any other definite refusal", () => {
    assert.equal(hours(renewAgainAt({ issue: "AUTHORIZATION_VOIDED", definite: true }, now, expires)), 24);
  });

  it("changes nothing when PayPal gave no answer", () => {
    assert.equal(renewAgainAt({ issue: null, definite: false }, now, expires), null);
  });
});
