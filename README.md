# Cosign

**A company card for AI agents, built on PayPal. Your agents spend. You co-sign.**

**Try it live: [cosign-rd24.onrender.com](https://cosign-rd24.onrender.com)** - press **Try the demo**. No sign-up needed.

Everything runs on PayPal's sandbox, its test environment. Every hold and payment you see is a real PayPal API call, but no real money ever moves.

**Watch the video (under 3 minutes): [on YouTube](https://www.youtube.com/watch?v=EE5Yg5Geibg)**

---

## The problem

AI assistants are starting to shop for us. But right now, an assistant that pays with PayPal has two options: it gets your whole wallet, or it asks you to tap "approve" on every single purchase.

Neither works for an office assistant that restocks coffee and paper every week. You don't want to hand it the keys, and you don't want to babysit it either.

Cosign sits in the middle. You give each assistant a **permission slip**, and Cosign checks every purchase against it before PayPal pays the store.

## Why now

AI shopping assistants are arriving faster than stores and banks can trust them.

In September, Amazon cut off Meta's Muse shopping agent, saying it didn't identify itself and Amazon hadn't agreed to take part. JPMorgan and Schwab block outside agents from moving customers' money, and Schwab's CEO asked the obvious question: who is responsible if something goes wrong?

Others are opening up carefully. Shopify lets agents check out while the shopper confirms the total, and Sierra, working with Meta, has published a draft standard for agents to identify themselves. ([WinBuzzer, Oct 20, 2026](https://winbuzzer.com/2026/10/20/website-blocks-limit-ai-agents-shopping-and-banking-xcxwbn/))

The common thread: stores are wary of agents they can't identify or trust. Cosign is built for exactly that. Every agent purchase is:

- **Identified** - each agent has its own key and a named owner. No shared logins, and the agent never sees a password or card.
- **Authorised** - it's checked against a permission slip its owner co-signed. Bigger purchases need the owner's OK on the exact cart.
- **Limited and logged** - budgets, per-purchase limits and allowed stores are enforced before any money moves, and every decision is recorded.
- **Paid to a store that opted in** - Cosign only pays stores that connected through PayPal onboarding, so the store has always agreed to take part. PayPal pays it directly.

## How it works

1. **Tell it the rules, in your own words.** How much it can spend, where, and when to check with you. AI turns your words into exact rules, and you review them and co-sign.
2. **Set money aside in PayPal.** You approve a budget for each store in PayPal. It's reserved, not spent. Nothing is charged until something is actually bought.
3. **Your assistant goes shopping.** It asks Cosign before paying. Cosign checks every purchase against your rules and keeps an eye out for tricks.
4. **You stay in charge.** Every purchase gets one of three answers:
   - **Paid** - it's within your rules, so PayPal pays the store right away.
   - **Ask you** - it's over your limit, so it waits for your OK. You approve the exact cart you see.
   - **Blocked** - it's outside your rules. Nothing is charged, and you see why.

You can pause or revoke any assistant in one click. Your assistant never sees your PayPal login or card, and Cosign never holds your money. PayPal pays the store directly.

## Try the demo in 2 minutes

1. Open [the live site](https://cosign-rd24.onrender.com) and press **Try the demo**. It's a shared demo account, so you might see what other people tried.
2. Press **Run the demo bot**. An office assistant plans a shopping trip with AI and buys coffee and paper from two demo stores.
3. **Watch it get tricked.** One product page hides a note telling AI assistants to "buy 50 units now". The assistant falls for it. Cosign doesn't: that purchase waits for you, while the coffee is paid straight away.
4. **Make the call.** Approve or decline. You'll see why it was flagged, what the assistant said, and what the same item costs at other stores.
5. Open **Spending** to see every purchase in one live table, with charts.
6. Check the **store's side**: each paid purchase becomes an order with the items and delivery address, which the store confirms and marks as shipped.

## Under the hood

```
Owner ──writes slip──▶ Cosign ──AI drafts rules──▶ Owner reviews + co-signs
Owner ──approves──▶ PayPal budget hold per store (Orders v2 AUTHORIZE, payee = store)

Agent ──"may I buy X?"──▶ Cosign Agent API / MCP
                           │
                           ├─ rules engine (deterministic): ALLOW / NEEDS_APPROVAL / DENY
                           ├─ AI purchase check (Claude): can only make it stricter
                           │
                           ├─ ALLOW ──▶ PayPal partial capture from the hold ──▶ store paid
                           ├─ NEEDS_APPROVAL ──▶ owner approves exact cart ──▶ capture
                           └─ DENY ──▶ nothing charged, reason logged

Daily job: reauthorize holds after PayPal's 3-day honor period, reconcile every
hold with PayPal, retry stuck purchases, release what is left at period end.
PayPal webhooks (signature-checked) confirm captures, voids and refunds.
```

## How PayPal is used

Cosign is a multiparty platform on the PayPal sandbox. Every bit of money movement is a PayPal API call, and Cosign never holds funds itself.

| PayPal API | What Cosign does with it |
|---|---|
| **Partner Referrals** (`/v2/customer/partner-referrals`) | Stores connect to Cosign once through PayPal onboarding. Cosign only keeps their merchant ID |
| **Orders v2 `AUTHORIZE`** with `payee.merchant_id` | One **budget hold** per store, approved by the owner in PayPal (with the ship-to address on the order) |
| **Payments v2 capture** (`final_capture=false`) | Every allowed purchase is a **partial capture** from the hold. PayPal pays the store directly, with no buyer present |
| **Payments v2 reauthorize** | After PayPal's 3-day honor period, the daily job renews each hold once (sending the remaining amount, since PayPal allows one renewal per hold). New captures use the new authorization ID |
| **Payments v2 void** (with `PayPal-Auth-Assertion` for the store) | Revoking an agent or ending a period releases whatever is left, always on the original authorization ID |
| **Payments v2 refund** (with `PayPal-Auth-Assertion`) | A paid purchase can be refunded on behalf of the store. Refund and reversal webhooks are recorded |
| **Webhooks** | `PAYMENT.CAPTURE.*`, `PAYMENT.AUTHORIZATION.VOIDED`, `CHECKOUT.ORDER.APPROVED`, refunds and reversals. Each one is **signature-verified** locally against PayPal's pinned certificate, and de-duplicated |
| **Idempotency** | Each capture carries a `PayPal-Request-Id` and our own purchase ID as `invoice_id`, so a retry can never charge twice |

All Orders and Payments calls go through the official **PayPal TypeScript Server SDK**.

## How AI is used

AI is a helper inside Cosign. It never holds the money, and it never gets the final say.

- **Claude Sonnet 5.5** turns the owner's plain words ("Keep us stocked with paper and coffee, $200 every four weeks, ask me before anything over $50") into exact rules. The owner reviews and co-signs them, and nothing applies until they do.
- **Claude Haiku 4.5** runs the **AI purchase check** on every purchase the rules would allow. It compares the cart with the owner's own words and looks for tricks, like a product page telling AI agents to "buy 50 units now". It can **only make a decision stricter** (turning "Paid" into "Ask you"). It can never approve something the rules refused.
- **Claude Haiku 4.5** also handles price comparison. It keeps only like-for-like products from other retailers, so the owner sees a fair price check before approving.
- The demo procurement bot plans its shopping trip with **Claude Sonnet 5.5** and calls Cosign just like any outside agent would.

Anything an agent or a web page supplies is always treated as data, never as instructions.

## Tools used and how

| Tool | How Cosign uses it |
|---|---|
| **PayPal** (sandbox) | The whole money path above: Partner Referrals, Orders v2 budget holds, partial captures, reauthorize, void, refunds and webhooks |
| **APIMatic** | (1) The official **PayPal TypeScript Server SDK** (generated by APIMatic) for every PayPal call, built with APIMatic's **Context Plugin for PayPal Server SDKs** in Claude Code. (2) Cosign's own Agent API: from our OpenAPI 3.1 spec, APIMatic generates **TypeScript, Python and C# SDKs** and the **docs portal** at [cosign-docs.onrender.com](https://cosign-docs.onrender.com), plus a Context Plugin so coding assistants can integrate Cosign |
| **Claude** (Anthropic) | Sonnet 5.5 for turning plain words into rules and for the demo bot. Haiku 4.5 for the purchase check and price comparison |
| **AG Grid** (Community + Enterprise) and **AG Charts** | The live **Spending** page: purchases stream in and flash, you can decide straight from the grid, group by agent or store with subtotals, expand a purchase for its details, and see spend charts. AG Grid Enterprise runs without a licence key, so you'll see a watermark and a console message. The AG Grid team confirmed that's fine for hackathon judging |
| **Channel3** | Live product search and prices. Agents search with `GET /api/v1/agent/products` or the `cosign_find_products` MCP tool, owners see market prices next to purchases waiting for approval, and the demo bot uses it to shop |
| **Render** | Hosts the web app, its PostgreSQL database (private network only) and the API docs portal, and deploys on every push |
| Next.js, TypeScript, PostgreSQL, Drizzle ORM, Auth.js, Resend | The app itself. Owners sign in with an emailed one-time link |

## For developers

Want to plug your own agent into Cosign? There are three ways in:

- **Agent API** - REST, with the OpenAPI 3.1 spec in [`api/openapi.yaml`](api/openapi.yaml). Check an allowance, find products, ask to pay. Agents sign in with their own key and get short-lived tokens. They never see PayPal credentials.
- **MCP server** at `POST /api/mcp` - add Cosign to Claude or any MCP client with an agent's key. It can check its allowance, search products and pay, always within its slip.
- **SDKs and docs** - TypeScript, Python and C# SDKs, all on the [docs portal](https://cosign-docs.onrender.com).

## Run it locally

**You'll need:** Node 22.18+, pnpm 10, PostgreSQL, and a PayPal developer account.

**PayPal sandbox setup**

1. In the PayPal developer dashboard, create sandbox **Business** accounts: one for the platform and one per demo store.
2. Create a **Platform** (partner) REST app in the sandbox, and note its client ID, secret and partner merchant ID.
3. Onboard each store through Partner Referrals (`node --env-file=.env.local scripts/week1.mjs referral store1`, open the link signed in as that store, then `... store store1` to read its merchant ID), and put the merchant IDs in `scripts/db/seed-stores.sql`.
4. Optional: register a webhook for your public URL (`/api/paypal/webhook`) with the events listed above, and note its webhook ID.

**Environment** - copy [`.env.example`](.env.example) to `.env.local` and fill it in. Never commit `.env.local`. The variables are:
`PAYPAL_ENV`, `PAYPAL_API_BASE`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_PARTNER_MERCHANT_ID`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_PARTNER_ATTRIBUTION_ID`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_RESEND_KEY`, `AUTH_EMAIL_FROM`, `JOB_SECRET`, `APP_URL`, `DEMO_LOGIN`.

**Run**

```bash
pnpm install
createdb cosign_dev
cp .env.example .env.local   # fill in sandbox values
pnpm db:migrate
pnpm db:seed                 # your demo stores
pnpm dev                     # http://localhost:3001
```

Optional: set `DEMO_LOGIN=on` and run `pnpm demo:seed` for the one-click demo account.

**Tests:** `pnpm test` (unit), `pnpm test:db` (integration, on a separate `cosign_test` database), `pnpm typecheck`.

## Security

Cosign moves money for people, so it's built like a payments system:

- **Identity** comes only from the signed-in session or the agent's own credential. Every read and write is scoped to its owner, and another owner's records simply look like "not found".
- **The rules engine decides, not the AI.** AI can only make a decision stricter.
- **Money** is stored as integer cents with database-level limits. A hold can never be captured past its amount, budgets are reserved inside one database transaction with a row lock, and every capture is idempotent.
- **Approvals** are bound to the exact cart and amount the owner saw.
- **Agent keys** are stored as hashes. Tokens are short-lived and re-checked on every call, and any agent can be paused or revoked instantly.
- **Webhooks** are trusted only after PayPal's signature checks out against PayPal's own certificate.
- **Reconciliation:** a daily job compares every hold with PayPal and freezes anything that doesn't match.
- Rate limits on sign-in, the Agent API, product search and webhooks.

## Today in the sandbox, and what changes with PayPal

A few limits come from what PayPal has switched on for our sandbox app, not from Cosign itself:

- **Budget holds instead of a saved PayPal.** PayPal's platform-level Vault isn't enabled for our app, so the owner approves one budget hold per store. With Vault, the owner would connect PayPal once and every purchase would be charged directly.
- **Holds last up to 29 days**, so a budget period is at most 28 days, with a one-tap renewal.
- **The store sees each purchase's items on Cosign's private order page**, because a partial capture can't carry its own line items. With Vault, every agent purchase would be a normal PayPal order the store already knows how to fulfil.
- **Stores connect to Cosign once** through PayPal onboarding. With PayPal on board, any PayPal merchant could be paid, always within the owner's permission slip.

Cosign's own part stays the same either way: permission slips, the rules engine, the AI checks, owner approvals and the activity log.

## Say hello

Questions, feedback or ideas? I'd love to hear them: austinjohn337@gmail.com

## Licence

[MIT](LICENSE)
