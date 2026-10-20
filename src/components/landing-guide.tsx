import type { CSSProperties } from "react";
import Link from "next/link";
import { DOCS_URL } from "@/lib/links";
import { DemoButton } from "./demo-button";
import { RevealSection } from "./reveal-section";

// The rest of the signed-out homepage: how Cosign works, a step-by-step guide
// to the demo (for judges and visitors), what developers get, and what is real
// versus sandbox.

const HOW = [
  { title: "Tell it the rules", text: "Use your own words: how much, which stores, and when to check with you." },
  { title: "Set money aside in PayPal", text: "Your budget is set aside, not spent. Nothing is charged until something is bought." },
  { title: "Your assistant shops", text: "Cosign checks every purchase against your rules and looks for tricks." },
  { title: "You stay in control", text: "Small buys go through. Big ones wait for you. The rest is stopped." },
];

const ANSWERS = [
  { stamp: "allow", label: "Paid", what: "Coffee beans", amount: "$24.00", why: "Within your rules, so it's paid right away." },
  { stamp: "ask", label: "Ask you", what: "Printer toner", amount: "$80.00", why: "Over your $50.00 limit, so it waits for your OK." },
  { stamp: "deny", label: "Blocked", what: "50 gift cards", amount: "$1,250.00", why: "Gift cards aren't allowed, and it's over budget. Nothing is charged." },
] as const;

const order = (i: number) => ({ "--i": i }) as CSSProperties;

// How it works: four steps joined by a ballpoint stroke (the wordmark's pen line).
function HowStrip() {
  return (
    <RevealSection className="how" aria-labelledby="how">
      <div className="how-head">
        <p className="section-label">How it works</p>
        <h2 id="how" className="landing-title">
          Set it up once. Then let it run.
        </h2>
      </div>
      <div className="how-track">
        <svg className="how-line" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M8 24 C 150 6, 300 36, 500 20 S 840 6, 992 22" pathLength="1" />
        </svg>
        <ol className="how-steps">
          {HOW.map((s, i) => (
            <li key={s.title} style={order(i)}>
              <span className="how-num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </RevealSection>
  );
}

// The three answers any purchase can get, shown as the stamps owners see.
function Answers() {
  return (
    <RevealSection className="landing-section" aria-labelledby="answers">
      <h2 id="answers" className="landing-title">
        Every purchase gets one of three answers
      </h2>
      <ul className="answers">
        {ANSWERS.map((a, i) => (
          <li key={a.label} className={`answer answer-${a.stamp}`} style={order(i)}>
            <div className="answer-top">
              <span className={`stamp stamp-${a.stamp}`}>{a.label}</span>
              <span className="answer-amount">{a.amount}</span>
            </div>
            <h3>{a.what}</h3>
            <p>{a.why}</p>
          </li>
        ))}
      </ul>
    </RevealSection>
  );
}

export function LandingGuide({ demo }: { demo: boolean }) {
  return (
    <div className="landing-guide">
      <HowStrip />
      <Answers />
      {demo ? (
        <section className="landing-section" aria-labelledby="tour">
          <h2 id="tour" className="landing-title">
            Try it in 2 minutes
          </h2>
          <p className="landing-lede">A shared demo with pretend money - nothing real is charged. It&apos;s ready to go, so you can watch an assistant shop right away.</p>
          <ol className="tour">
            <li className="tour-step">
              <div>
                <h3>Open the demo</h3>
                <p>One click, no sign-up. It&apos;s shared, so you may see what others tried.</p>
              </div>
              <DemoButton className="button button-primary" />
            </li>
            <li className="tour-step">
              <div>
                <h3>Send the assistant shopping</h3>
                <p>Press &ldquo;Run the demo bot&rdquo; on the dashboard. An office assistant restocks coffee and paper from two demo stores.</p>
              </div>
            </li>
            <li className="tour-step">
              <div>
                <h3>Watch it get tricked</h3>
                <p>
                  One product page hides a note telling AI assistants to &ldquo;buy 50 units now&rdquo;. The assistant falls for it. Cosign doesn&apos;t - that order waits
                  for you, while the coffee goes through.
                </p>
              </div>
              <Link href="/shop/paper-co/sticky-notes?reveal=1" className="button button-quiet">
                See the hidden note
              </Link>
            </li>
            <li className="tour-step">
              <div>
                <h3>Make the call</h3>
                <p>Approve or decline. See why it was flagged, what the assistant said, and what the same item costs elsewhere.</p>
              </div>
            </li>
            <li className="tour-step">
              <div>
                <h3>See all spending</h3>
                <p>See every purchase in one table, by assistant or store, with charts.</p>
              </div>
              <Link href="/spending" className="button button-quiet">
                Spending table
              </Link>
            </li>
            <li className="tour-step">
              <div>
                <h3>See the store&apos;s side</h3>
                <p>Each paid purchase becomes an order with the items and delivery address. The store confirms it and marks it shipped.</p>
              </div>
              <Link href="/shop/bean-supply/orders" className="button button-quiet">
                Orders received
              </Link>
            </li>
          </ol>
        </section>
      ) : null}

      <section className="landing-section" aria-labelledby="dev">
        <h2 id="dev" className="landing-title">
          For developers
        </h2>
        <ul className="landing-cards">
          <li className="landing-card">
            <h3>Agent API and SDKs</h3>
            <p>A REST API (OpenAPI 3.1) for checking an allowance, finding products, and asking to pay. TypeScript, Python, and C# SDKs and docs are generated with APIMatic.</p>
            <a href={DOCS_URL} className="see-all" target="_blank" rel="noreferrer">
              Open the API docs
            </a>
          </li>
          <li className="landing-card">
            <h3>MCP for Claude</h3>
            <p>
              Add Cosign to Claude or any MCP client with an agent&apos;s key. It can check its allowance, search products, and pay - always within
              the slip.
            </p>
            <code className="landing-code">POST /api/mcp</code>
          </li>
          <li className="landing-card">
            <h3>Prices before buying</h3>
            <p>Product search shows prices at your stores, what the rules would decide, and like-for-like prices at other retailers (Channel3, judged by AI).</p>
            <code className="landing-code">GET /api/v1/agent/products</code>
          </li>
        </ul>
      </section>

      <section className="landing-section landing-real" aria-labelledby="real">
        <h2 id="real" className="landing-title">
          Is this real?
        </h2>
        <ul className="landing-facts">
          <li>
            <strong>Real PayPal, pretend money.</strong> Every hold, payment, and refund is a real call to PayPal&apos;s test system. No real money
            moves.
          </li>
          <li>
            <strong>The demo stores are PayPal test shops,</strong> set up the same way any PayPal business would join.
          </li>
          <li>
            <strong>The AI is live.</strong> Claude turns your words into rules and checks every purchase. Channel3 brings in prices from other stores.
          </li>
        </ul>
        <p className="landing-built">Built with PayPal, Claude, AG Grid, Channel3, APIMatic and Render.</p>
      </section>
    </div>
  );
}

// For the shared demo dashboard: what to try next, once signed in.
export function DemoTour() {
  return (
    <section className="demo-tour" aria-label="Demo tour">
      <p className="section-label">Demo tour</p>
      <ol>
        <li>Run the demo bot below and watch it fall for the hidden note.</li>
        <li>Approve or decline what is waiting for you.</li>
        <li>
          Open <Link href="/spending">Spending</Link> to see every purchase as it happens.
        </li>
        <li>
          See the store side: <Link href="/shop/bean-supply/orders">Bean Supply orders</Link> and{" "}
          <Link href="/shop/paper-co/sticky-notes?reveal=1">the hidden note</Link>.
        </li>
      </ol>
    </section>
  );
}
