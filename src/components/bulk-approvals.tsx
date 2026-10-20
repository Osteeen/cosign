"use client";

import { useEffect, useId, useRef, useState } from "react";
import { decideManyAction } from "@/app/actions";
import { formatUsd } from "@/lib/money";
import { SubmitButton } from "./submit-button";

// "Approve selected" / "Decline selected" for waiting purchases, shared by the
// dashboard (checkboxes on the approval cards) and the spending grid (row
// selection). "Select all" skips purchases the AI check flagged: those must be
// ticked one by one, on purpose. One confirm lists every cart and the total.

// value = "approvalId|cartHash|totalCents": the owner approves exactly this cart.
export type BulkItem = { value: string; cents: number; flagged: boolean; label: string };

export function BulkDecisionBar({
  formId,
  selected,
  onSelectAll,
  onClear,
  back = "/",
  renderInputs = false,
  hint = "Tick purchases to decide several at once",
}: {
  formId: string;
  selected: BulkItem[];
  onSelectAll: () => void;
  onClear: () => void;
  // Where to land afterwards ("/" or "/spending").
  back?: "/" | "/spending";
  // The grid has no form fields of its own, so the bar carries the selection.
  renderInputs?: boolean;
  hint?: string;
}) {
  const [mode, setMode] = useState<"approve" | "deny">("approve");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = (m: "approve" | "deny") => {
    setMode(m);
    dialog.current?.showModal();
  };

  const total = selected.reduce((s, i) => s + i.cents, 0);
  const flaggedCount = selected.filter((i) => i.flagged).length;
  const n = selected.length;

  return (
    <div className="bulk-bar">
      <div className="bulk-pick">
        <button type="button" className="link-button" onClick={n ? onClear : onSelectAll}>
          {n ? "Clear selection" : "Select all not flagged"}
        </button>
        <span className="bulk-count" aria-live="polite">
          {n ? `${n} selected - ${formatUsd(total)}` : hint}
        </span>
      </div>
      <div className="bulk-actions">
        <button type="button" className="button button-quiet" disabled={!n} onClick={() => open("deny")}>
          Decline selected
        </button>
        <button type="button" className="button button-primary" disabled={!n} onClick={() => open("approve")}>
          Approve selected
        </button>
      </div>

      {/* The dialog sits inside the form so the pay button shows progress and
          cannot be pressed twice. One dialog, closed only by its own buttons. */}
      <form id={formId} action={decideManyAction}>
        <input type="hidden" name="decision" value={mode} />
        <input type="hidden" name="back" value={back} />
        {renderInputs ? selected.map((i) => <input key={i.value} type="hidden" name="item" value={i.value} />) : null}
        <dialog ref={dialog} className="dialog" aria-labelledby={titleId}>
          <div className={`dialog-body${mode === "deny" ? " dialog-danger" : ""}`}>
            <h2 id={titleId} className="dialog-title">
              {mode === "approve" ? `Pay ${formatUsd(total)} for ${n} ${n === 1 ? "purchase" : "purchases"}?` : `Decline ${n} ${n === 1 ? "purchase" : "purchases"}?`}
            </h2>
            <div className="dialog-text">
              <ul className="bulk-list">
                {selected.map((i) => (
                  <li key={i.value}>
                    <span>
                      {i.label}
                      {i.flagged ? <span className="flag-tag">Flagged</span> : null}
                    </span>
                    <span className="mono">{formatUsd(i.cents)}</span>
                  </li>
                ))}
              </ul>
              {mode === "approve" && flaggedCount ? (
                <p className="dialog-warn">
                  {flaggedCount === 1 ? "One of these was" : `${flaggedCount} of these were`} flagged by the purchase check. Only approve if you expected {flaggedCount === 1 ? "it" : "them"}.
                </p>
              ) : null}
              <p>
                {mode === "approve"
                  ? "Each purchase is checked and paid on its own, exactly as you saw it. If one changed or was already decided, it is skipped and nothing is charged for it."
                  : "Nothing is charged, and each amount goes back into its budget."}
              </p>
            </div>
            <div className="dialog-actions">
              <button type="button" className="button button-quiet" onClick={() => dialog.current?.close()} autoFocus>
                Cancel
              </button>
              <SubmitButton className={mode === "approve" ? "button button-primary" : "button button-danger"} pendingLabel={mode === "approve" ? "Paying" : "Declining"}>
                {mode === "approve" ? `Pay ${formatUsd(total)}` : "Decline"}
              </SubmitButton>
            </div>
          </div>
        </dialog>
      </form>
    </div>
  );
}

// Dashboard version: the checkboxes are on the approval cards (form="bulk-approvals").
const boxes = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[form="bulk-approvals"][name="item"]'));
const read = (b: HTMLInputElement): BulkItem => ({
  value: b.value,
  cents: Number(b.dataset.cents),
  flagged: b.dataset.flagged === "1",
  label: b.dataset.label ?? "",
});

export function BulkApprovals({ count }: { count: number }) {
  const [selected, setSelected] = useState<BulkItem[]>([]);

  useEffect(() => {
    const sync = () => setSelected(boxes().filter((b) => b.checked).map(read));
    const all = boxes();
    all.forEach((b) => b.addEventListener("change", sync));
    sync();
    return () => all.forEach((b) => b.removeEventListener("change", sync));
  }, [count]);

  return (
    <BulkDecisionBar
      formId="bulk-approvals"
      selected={selected}
      onSelectAll={() => {
        const all = boxes();
        all.forEach((b) => (b.checked = !read(b).flagged));
        setSelected(all.filter((b) => b.checked).map(read));
      }}
      onClear={() => {
        boxes().forEach((b) => (b.checked = false));
        setSelected([]);
      }}
    />
  );
}
