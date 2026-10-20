import { decideApprovalAction } from "@/app/actions";
import { formatUsd } from "@/lib/money";
import { ConfirmDialog } from "./confirm-dialog";
import { LocalTime } from "./local-time";

type Item = { name: string; quantity: number; unit_amount_cents: number };

// A purchase waiting for the owner. Approve and decline both confirm first,
// and both send the exact cart hash and total the owner saw.
export function ApprovalCard({
  approvalId,
  agentName,
  storeName,
  totalCents,
  cartHash,
  purpose,
  items,
  reasons,
  expiresAt,
  back = "/",
  selectable = false,
  market = null,
}: {
  approvalId: string;
  agentName: string;
  storeName: string;
  totalCents: number;
  cartHash: string;
  purpose: string;
  items: Item[];
  reasons: { code: string; message: string }[];
  expiresAt: Date;
  back?: string;
  // On the dashboard: a checkbox that feeds the "Approve selected" bar.
  selectable?: boolean;
  // Channel3 market prices for the first item, if checked.
  market?: { summary: string; note: string | null } | null;
}) {
  const flagged = reasons.some((r) => r.code === "INTENT_FLAGGED");
  const hidden = (decision: "approve" | "deny") => (
    <>
      <input type="hidden" name="approvalId" value={approvalId} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="cartHash" value={cartHash} />
      <input type="hidden" name="totalCents" value={totalCents} />
      <input type="hidden" name="back" value={back} />
    </>
  );
  return (
    <article className="approval">
      <div className="approval-head">
        {selectable ? (
          <label className="check approval-select">
            <input
              type="checkbox"
              form="bulk-approvals"
              name="item"
              value={`${approvalId}|${cartHash}|${totalCents}`}
              data-cents={totalCents}
              data-flagged={flagged ? "1" : undefined}
              data-label={`${agentName} - ${storeName}`}
            />
            <span className="visually-hidden">
              Select {formatUsd(totalCents)} to {storeName}
            </span>
          </label>
        ) : null}
        <span className="stamp stamp-ask">Ask you</span>
        <span className="approval-amount">{formatUsd(totalCents)}</span>
      </div>
      <p>
        <strong>{agentName}</strong> wants to pay <strong>{storeName}</strong>
        <span className="tag">Demo store (PayPal sandbox)</span>
      </p>
      <ul className="approval-items">
        {items.map((i, n) => (
          <li key={n}>
            <span>
              {i.quantity} x {i.name}
            </span>
            <span className="mono">{formatUsd(i.quantity * i.unit_amount_cents)}</span>
          </li>
        ))}
      </ul>
      <div className="approval-why">
        <div className="approval-label-row">
          <span className="approval-label">Why Cosign is asking</span>
          {flagged ? <span className="flag-tag">Flagged by purchase check</span> : null}
        </div>
        <ul className="approval-reasons">
          {reasons.map((r, n) => (
            <li key={n}>{r.message}</li>
          ))}
        </ul>
      </div>
      {market ? (
        <div className="approval-market">
          <span className="approval-label">Market price - Channel3</span>
          <p>{market.summary}</p>
          {market.note ? <p className="approval-market-note">{market.note}</p> : null}
        </div>
      ) : null}
      {/* The agent's own words are untrusted: shown quoted and apart from our verdict. */}
      <figure className="approval-said">
        <figcaption className="approval-label">The agent said</figcaption>
        <blockquote>{purpose}</blockquote>
      </figure>
      <p className="approval-expires">
        Decide by <LocalTime iso={expiresAt.toISOString()} />. If you do nothing, it is declined.
      </p>
      <div className="approval-actions">
        <ConfirmDialog trigger="Decline" title="Decline this purchase?" confirmLabel="Decline" pendingLabel="Declining" action={decideApprovalAction} tone="danger">
          <p>Nothing will be charged, and the amount goes back into the budget.</p>
          {hidden("deny")}
        </ConfirmDialog>
        <ConfirmDialog
          trigger="Approve"
          triggerClassName="button button-primary"
          title={`Pay ${formatUsd(totalCents)} to ${storeName}?`}
          confirmLabel={`Pay ${formatUsd(totalCents)}`}
          pendingLabel="Paying"
          action={decideApprovalAction}
        >
          {flagged ? <p className="dialog-warn">The purchase check flagged this. Only approve it if you expected this purchase.</p> : null}
          <p>PayPal pays the store from your budget hold. You approve exactly this cart; if it changed, nothing is charged.</p>
          {hidden("approve")}
        </ConfirmDialog>
      </div>
    </article>
  );
}
