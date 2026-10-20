"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { validateForm } from "@/lib/client/validate";
import { FieldError, invalidProps } from "./field-error";
import { createSlipAction, draftSlipAction, type SlipFormState } from "@/app/actions";
import { formatUsd, parseDollars } from "@/lib/money";
import { ConfirmDialog } from "./confirm-dialog";
import { DatePicker } from "./date-picker";
import { CATEGORY_LABELS } from "@/lib/categories";


export function SlipForm({
  agentId,
  agentName,
  stores,
  addresses,
}: {
  agentId: string;
  agentName: string;
  stores: { id: string; name: string }[];
  addresses: { id: string; label: string; summary: string }[];
}) {
  const [state, formAction] = useActionState<SlipFormState, FormData>(createSlipAction, { status: "idle" });
  const [budget, setBudget] = useState("200");
  const [periodDays, setPeriodDays] = useState("28");
  const [perPurchase, setPerPurchase] = useState("100");
  const [approveAbove, setApproveAbove] = useState("50");
  const [chosen, setChosen] = useState<string[]>(stores.map((s) => s.id));
  const [shares, setShares] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>(["office_supplies", "groceries"]);
  const [shipTo, setShipTo] = useState<string>(addresses[0]?.id ?? "");
  const [words, setWords] = useState("");
  const [endsOn, setEndsOn] = useState<string | null | undefined>(undefined);
  const [drafting, setDrafting] = useState(false);
  const [draftNotes, setDraftNotes] = useState<{ tone: "ok" | "warn" | "bad"; lines: string[] } | null>(null);

  // Ask Claude to turn the owner's words into the fields below. It only fills
  // the form; the owner reviews and co-signs as usual.
  async function fillFromWords() {
    setDrafting(true);
    setDraftNotes(null);
    try {
      const res = await draftSlipAction(agentId, words);
      if (!res.ok) {
        setDraftNotes({ tone: "bad", lines: [res.message] });
        return;
      }
      const d = res.draft;
      const dollars = (v: number | null) => (v === null ? "" : (Math.round(v * 100) / 100).toString());
      // Anything the owner didn't say is cleared, so they choose it rather than
      // inherit a default they never read.
      setBudget(dollars(d.budget_dollars));
      setPeriodDays(d.period_days === null ? "" : String(d.period_days));
      setPerPurchase(dollars(d.per_purchase_max_dollars));
      setApproveAbove(dollars(d.approve_above_dollars));
      if (d.store_ids.length) setChosen(d.store_ids);
      if (d.categories.length) setCategories(d.categories);
      setShares({});
      setEndsOn(d.ends_on);
      setErrors({});
      setDraftNotes({ tone: d.notes.length ? "warn" : "ok", lines: d.notes.length ? d.notes : ["Filled in from your words. Check every field before you co-sign."] });
    } catch {
      setDraftNotes({ tone: "bad", lines: ["Drafting is not available right now. Fill in the fields yourself."] });
    } finally {
      setDrafting(false);
    }
  }
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  // Runs before the co-sign dialog opens: nothing gets co-signed with errors.
  function checkSlip(): boolean {
    const found = formRef.current ? validateForm(formRef.current) : {};
    if (chosen.length === 0) found.storeIds = "Choose at least one store.";
    if (categories.length === 0) found.categories = "Choose at least one category.";
    if (overHeld) found.shares = "over budget";
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  const budgetCents = parseDollars(budget);
  const anyShare = chosen.some((id) => (shares[id] ?? "").trim() !== "");
  const split = useMemo(() => {
    if (!budgetCents || chosen.length === 0) return new Map<string, number>();
    if (anyShare) return new Map(chosen.map((id) => [id, parseDollars(shares[id] ?? "") ?? 0]));
    const base = Math.floor(budgetCents / chosen.length);
    const extra = budgetCents - base * chosen.length;
    return new Map(chosen.map((id, i) => [id, base + (i < extra ? 1 : 0)]));
  }, [budgetCents, chosen, shares, anyShare]);
  const held = [...split.values()].reduce((a, b) => a + b, 0);
  const overHeld = budgetCents !== null && held > budgetCents;

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const formId = "slip-form";

  return (
    <form
      id={formId}
      ref={formRef}
      action={formAction}
      className="slip-form"
      noValidate
      onSubmit={(e) => {
        if (!checkSlip()) e.preventDefault();
      }}
      onInput={(e) => {
        const name = (e.target as HTMLInputElement).name;
        if (errors[name]) setErrors({ ...errors, [name]: "" });
      }}
    >
      <input type="hidden" name="agentId" value={agentId} />

      <div className="slip panel-stack">
        <div className="field">
          <label htmlFor="sourceText" className="field-label">
            In your words
          </label>
          <p id="sourceText-help" className="field-help">
            Describe the job in plain words. Cosign uses this to spot purchases that fit the numbers but not your intent.
          </p>
          <textarea
            id="sourceText"
            aria-describedby="sourceText-help"
            name="sourceText"
            className="field-input field-textarea"
            rows={2}
            maxLength={1000}
            placeholder="Keep us stocked with paper and coffee. $200 a month, and ask me before anything over $50."
            value={words}
            onChange={(e) => setWords(e.target.value)}
          />
          <button type="button" className="button button-quiet draft-button" onClick={fillFromWords} disabled={drafting || words.trim().length < 5} aria-busy={drafting || undefined}>
            {drafting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Reading your words
              </>
            ) : (
              "Fill in the rules from my words"
            )}
          </button>
          {draftNotes ? (
            <div className={`notice notice-${draftNotes.tone}`} role="status">
              {draftNotes.lines.length === 1 ? (
                draftNotes.lines[0]
              ) : (
                <>
                  <p>Filled in. Check these before you co-sign:</p>
                  <ul className="draft-notes">
                    {draftNotes.lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="budget" className="field-label">
              Budget ($)
            </label>
            <input id="budget" name="budget" className="field-input" inputMode="decimal" pattern="\$?[0-9,]{1,9}(\.[0-9]{1,2})?" title="Enter a dollar amount, like 200 or 49.99." data-label="budget" {...invalidProps("budget", errors)} value={budget} onChange={(e) => setBudget(e.target.value)} required />
            <FieldError name="budget" errors={errors} />
          </div>
          <div className="field">
            <label htmlFor="periodDays" className="field-label">
              Every (days, max 28)
            </label>
            <input id="periodDays" name="periodDays" className="field-input" type="number" min={1} max={28} step={1} data-label="number of days" {...invalidProps("periodDays", errors)} value={periodDays} onChange={(e) => setPeriodDays(e.target.value)} required />
            <FieldError name="periodDays" errors={errors} />
          </div>
          <div className="field">
            <label htmlFor="perPurchase" className="field-label">
              Per purchase up to ($)
            </label>
            <input id="perPurchase" name="perPurchase" className="field-input" inputMode="decimal" pattern="\$?[0-9,]{1,9}(\.[0-9]{1,2})?" title="Enter a dollar amount, like 200 or 49.99." data-label="per-purchase limit" {...invalidProps("perPurchase", errors)} value={perPurchase} onChange={(e) => setPerPurchase(e.target.value)} required />
            <FieldError name="perPurchase" errors={errors} />
          </div>
          <div className="field">
            <label htmlFor="approveAbove" className="field-label">
              Ask me above ($)
            </label>
            <input id="approveAbove" name="approveAbove" className="field-input" inputMode="decimal" pattern="\$?[0-9,]{1,9}(\.[0-9]{1,2})?" title="Enter a dollar amount, like 200 or 49.99." data-label="ask-me-above amount" placeholder="Leave blank - ask me every time" {...invalidProps("approveAbove", errors)} value={approveAbove} onChange={(e) => setApproveAbove(e.target.value)} />
            <FieldError name="approveAbove" errors={errors} />
          </div>
        </div>

        <fieldset className="fieldset">
          <legend className="field-label">Stores and their share of the budget</legend>
          {stores.map((s) => {
            const on = chosen.includes(s.id);
            return (
              <div className="store-row" key={s.id}>
                <label className="check">
                  <input type="checkbox" name="storeIds" value={s.id} checked={on} onChange={() => setChosen(toggle(chosen, s.id))} />
                  <span>
                    {s.name} <span className="tag">Demo store (PayPal sandbox)</span>
                  </span>
                </label>
                {on ? (
                  <input
                    aria-label={`${s.name} share in dollars`}
                    name={`share-${s.id}`}
                    className="field-input share-input"
                    inputMode="decimal"
                    placeholder={split.has(s.id) && !anyShare ? (split.get(s.id)! / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                    value={shares[s.id] ?? ""}
                    onChange={(e) => setShares({ ...shares, [s.id]: e.target.value })}
                  />
                ) : null}
              </div>
            );
          })}
          <FieldError name="storeIds" errors={errors} />
          <p className={overHeld ? "field-error" : "muted"}>
            {chosen.length === 0
              ? "Choose at least one store."
              : overHeld
                ? `Store shares total ${formatUsd(held)}, more than the ${formatUsd(budgetCents!)} budget.`
                : `${anyShare ? "Your split" : "Even split"}: ${formatUsd(held)} held across ${chosen.length} store${chosen.length > 1 ? "s" : ""}.`}
          </p>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="field-label">Allowed categories</legend>
          <div className="check-grid">
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <label className="check" key={value}>
                <input type="checkbox" name="categories" value={value} checked={categories.includes(value)} onChange={() => setCategories(toggle(categories, value))} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <FieldError name="categories" errors={errors} />
        </fieldset>

        <fieldset className="fieldset">
          <legend className="field-label">Ship orders to</legend>
          <p className="muted field-help">Stores get this address with every paid order and see it in PayPal. {agentName} only sees the label.</p>
          <div className="check-grid check-grid-wide">
            {addresses.map((a) => (
              <label className="check" key={a.id}>
                <input type="radio" name="shipToAddressId" value={a.id} checked={shipTo === a.id} onChange={() => setShipTo(a.id)} />
                <span>
                  {a.label} <span className="muted">- {a.summary}</span>
                </span>
              </label>
            ))}
            <label className="check">
              <input type="radio" name="shipToAddressId" value="" checked={shipTo === ""} onChange={() => setShipTo("")} />
              <span>No address - nothing to ship (services or downloads)</span>
            </label>
          </div>
          <p className="muted">
            <a href={`/addresses?back=/agents/${agentId}/slip`}>{addresses.length ? "Add or change addresses" : "Add an address"}</a>
          </p>
        </fieldset>

        <DatePicker name="endsOn" label="End date (optional)" placeholder="No end date - runs until you end it" value={endsOn} />

        {state.status === "error" ? (
          <p className="field-error" role="alert">
            {state.message}
          </p>
        ) : null}

        <ConfirmDialog
          trigger="Review and co-sign"
          triggerClassName="button button-primary"
          title="Co-sign this slip?"
          confirmLabel="Co-sign"
          pendingLabel="Co-signing"
          formId={formId}
          beforeOpen={checkSlip}
        >
          <p>
            {agentName} can spend up to {budgetCents ? formatUsd(budgetCents) : "the budget"} every {periodDays} days, up to{" "}
            {formatUsd(parseDollars(perPurchase) ?? 0)} per purchase, and must ask you for purchases over {formatUsd(parseDollars(approveAbove) ?? 0)}.
          </p>
          <p>Next, approve a PayPal budget hold for each store. Your money stays in PayPal until a purchase is paid, then goes straight to the store.</p>
        </ConfirmDialog>
      </div>
    </form>
  );
}
