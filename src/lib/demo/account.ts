// The shared demo account judges sign in to with one click. It is an ordinary
// owner whose data is all PayPal-sandbox, with a fake, undeliverable address.
// Off unless DEMO_LOGIN=on. Actions that would release the shared PayPal budget
// holds (revoke, end slip, renew, new slip) are disabled for it, because new
// holds need a person to approve them in PayPal.

import "server-only";

export const DEMO_OWNER_ID = "demo-owner";
export const DEMO_OWNER_EMAIL = "demo@cosign.example";
export const DEMO_SESSION_HOURS = 2;

export const demoEnabled = () => process.env.DEMO_LOGIN === "on";
export const isDemoOwner = (ownerId: string) => ownerId === DEMO_OWNER_ID;
