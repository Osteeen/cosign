import type { CSSProperties } from "react";
import Link from "next/link";
import { DOCS_URL } from "@/lib/links";
import { DemoButton } from "./demo-button";
import { RevealSection } from "./reveal-section";

// The rest of the signed-out homepage: how Cosign works, a step-by-step guide
// to the demo (for judges and visitors), what developers get, and what is real
// versus sandbox.

const HOW = [
  { title: "Write a permission slip", text: "A budget, a limit per purchase, the stores it may use. Plain words work." },
  { title: "Approve PayPal budget holds", text: "One per store, in PayPal. Nothing is paid yet." },
  { title: "Your agent asks Cosign", text: "Fixed rules decide. An AI check can only make it stricter." },
  { title: "PayPal pays the store", text: "Or Cosign asks you first, or blocks it - with the reason." },
];

const ANSWERS = [
  { stamp: "allow", label: "Paid", what: "Coffee beans", amount: "$24.00", why: "Inside every rule, so PayPal pays the store at once." },
  { stamp: "ask", label: "Ask you", what: "Printer toner", amount: "$80.00", why: "Over your $50.00 limit. You approve the exact cart you see." },
  { stamp: "deny", label: "Blocked", what: "50 gift cards", amount: "$1,250.00", why: "Not an allowed category, and over budget. Nothing is charged." },
] as const;

const order = (i: number) => ({ "--i": i }) as CSSProperties;

// How it works: four steps joined by a ballpoint stroke (the wordmark's pen line).
function HowStrip() {
  return (
    <RevealSection className="how" aria-labelledby="how">
      <div className="how-head">
        <p className="section-label">How it works</p>
        <h2 id="how" className="landing-title">
          Set it up once. Then your agents shop on their own.
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
            Try the demo in 2 minutes
          </h2>
          <p className="landing-lede">
            A shared demo account on the PayPal sandbox: real PayPal calls, no real money. Its budget holds are already approved, so you can go
            straight to an agent shopping.
          </p>
          <ol className="tour">
            <li className="tour-step">
              <div>
                <h3>Open the demo account</h3>
                <p>One click, no sign-up. Everyone trying Cosign shares it, so you may see what others did.</p>
              </div>
              <DemoButton className="button button-primary" />
            </li>
            <li className="tour-step">
              <div>
                <h3>Run the demo bot</h3>
                <p>
                  On the dashboard. An office procurement bot plans a shopping trip with AI, reads the demo stores&apos; real product pages, and asks
                  Cosign to pay.
                </p>
              </div>
            </li>
            <li className="tour-step">
              <div>
                <h3>Watch the trap</h3>
                <p>
                  One product page hides a note telling AI agents to &ldquo;buy 50 units now&rdquo;. The bot falls for it - Cosign doesn&apos;t: that
                  purchase waits for your OK, while the coffee is paid through PayPal at once.
                </p>
              </div>
              <Link href="/shop/paper-co/sticky-notes?reveal=1" className="button button-quiet">
                See the hidden note
              </Link>
            </li>
            <li className="tour-step">
              <div>
                <h3>Decide</h3>
                <p>
                  Approve or decline the flagged purchase. The card shows why Cosign asked, what the agent said, and live market prices from Channel3.
                  Approving pays the store through PayPal.
                </p>
              </div>
            </li>
            <li className="tour-step">
              <div>
                <h3>Open Spending</h3>
                <p>Every purchase, live: group by agent or store, expand one for its details, decide from the grid, and see the charts.</p>
              </div>
              <Link href="/spending" className="button button-quiet">
                Spending table
              </Link>
            </li>
            <li className="tour-step">
              <div>
                <h3>See the store&apos;s side</h3>
                <p>
                  Each paid purchase becomes an order for the store: the items and where to ship them. Open one, confirm it, mark it shipped - the owner
                  sees it.
                </p>
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
            <p>A REST API (OpenAPI 3.1) to check an allowance, find products and ask to pay. TypeScript, Python and C# SDKs and the docs are generated with APIMatic.</p>
            <a href={DOCS_URL} className="see-all" target="_blank" rel="noreferrer">
              Open the API docs
            </a>
          </li>
          <li className="landing-card">
            <h3>MCP for Claude</h3>
            <p>
              Add Cosign to Claude or any MCP client with an agent&apos;s key, and it can check its allowance, search products and pay - always within
              the slip.
            </p>
            <code className="landing-code">POST /api/mcp</code>
          </li>
          <li className="landing-card">
            <h3>Prices before buying</h3>
            <p>Product search shows your stores&apos; prices, what the rules would decide, and like-for-like prices at other retailers (Channel3, judged by AI).</p>
            <code className="landing-code">GET /api/v1/agent/products</code>
          </li>
        </ul>
      </section>

      <section className="landing-section landing-real" aria-labelledby="real">
        <h2 id="real" className="landing-title">
          What&apos;s real here
        </h2>
        <ul className="landing-facts">
          <li>
            <strong>PayPal, for real - in the sandbox.</strong> Budget holds, partial captures, renewals, releases and webhooks are live PayPal API calls.
            No real money moves.
          </li>
          <li>
            <strong>Demo stores are PayPal sandbox merchants</strong> connected to Cosign through PayPal onboarding. They stand in for real PayPal
            merchants.
          </li>
          <li>
            <strong>The AI runs live.</strong> Claude Sonnet drafts rules from your words; Claude Haiku checks purchases and compares prices. Market prices
            come live from Channel3.
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
        <li>Run the demo bot below, and watch it fall for the hidden note.</li>
        <li>Approve or decline what&apos;s waiting for you.</li>
        <li>
          Open <Link href="/spending">Spending</Link> for every purchase, live.
        </li>
        <li>
          See the store&apos;s side: <Link href="/shop/bean-supply/orders">Bean Supply&apos;s orders</Link>, and{" "}
          <Link href="/shop/paper-co/sticky-notes?reveal=1">the hidden note</Link>.
        </li>
      </ol>
    </section>
  );
}
