"use client";

import { useEffect, useId, useRef, useState } from "react";

// A calendar in Cosign's form style. Submits YYYY-MM-DD through a hidden input
// named `name`. Keyboard: arrows move by day/week, Page Up/Down by month,
// Home/End to week start/end, Enter picks, Escape closes.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sameDay = (a: Date, b: Date) => iso(a) === iso(b);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
};
const label = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const short = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function DatePicker({
  name,
  label: fieldLabel,
  placeholder = "No end date",
  minDaysAhead = 1,
  value: controlled,
}: {
  name: string;
  label: string;
  placeholder?: string;
  minDaysAhead?: number;
  // YYYY-MM-DD set from outside (e.g. an AI draft); null clears it.
  value?: string | null;
}) {
  const today = new Date();
  const min = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), minDaysAhead);
  const [value, setValue] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<Date>(min);
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (controlled === undefined) return;
    if (controlled === null) setValue(null);
    else {
      const [y, m, day] = controlled.split("-").map(Number);
      if (y && m && day) setValue(new Date(y, m - 1, day));
    }
  }, [controlled]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep keyboard focus on the focused day.
  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${iso(focus)}"]`)?.focus();
  }, [open, focus]);

  const monthStart = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const lead = (monthStart.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(focus.getFullYear(), focus.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(focus.getFullYear(), focus.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);

  const clampToMin = (d: Date) => (d < min ? min : d);
  const pick = (d: Date) => {
    setValue(d);
    setOpen(false);
    triggerRef.current?.focus();
  };

  function onKey(e: React.KeyboardEvent) {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, -1),
      PageDown: () => addMonths(focus, 1),
      Home: () => addDays(focus, -((focus.getDay() + 6) % 7)),
      End: () => addDays(focus, 6 - ((focus.getDay() + 6) % 7)),
    };
    if (moves[e.key]) {
      e.preventDefault();
      setFocus(clampToMin(moves[e.key]!()));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  const canGoBack = addMonths(monthStart, -1) >= new Date(min.getFullYear(), min.getMonth(), 1);

  return (
    <div className="datepicker" ref={rootRef}>
      <span className="field-label" id={`${id}-label`}>
        {fieldLabel}
      </span>
      <input type="hidden" name={name} value={value ? iso(value) : ""} />
      <div className="datepicker-row">
        <button
          ref={triggerRef}
          type="button"
          className="datepicker-trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={`${id}-label ${id}-value`}
          onClick={() => {
            setFocus(value ?? min);
            setOpen(!open);
          }}
        >
          <span id={`${id}-value`} className={value ? undefined : "datepicker-placeholder"}>
            {value ? short(value) : placeholder}
          </span>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="3" y="4.5" width="14" height="12.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 8.5h14M7 2.5v4M13 2.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        {value ? (
          <button type="button" className="datepicker-clear" onClick={() => setValue(null)}>
            Clear
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="datepicker-pop" role="dialog" aria-modal="false" aria-label={`Choose ${fieldLabel.toLowerCase()}`} onKeyDown={onKey}>
          <div className="datepicker-head">
            <button type="button" className="icon-button" aria-label="Previous month" disabled={!canGoBack} onClick={() => setFocus(clampToMin(addMonths(focus, -1)))}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="datepicker-month" aria-live="polite">
              {MONTHS[focus.getMonth()]} {focus.getFullYear()}
            </span>
            <button type="button" className="icon-button" aria-label="Next month" onClick={() => setFocus(addMonths(focus, 1))}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="datepicker-grid" ref={gridRef} role="grid">
            {DAYS.map((d) => (
              <span key={d} className="datepicker-dow" aria-hidden="true">
                {d}
              </span>
            ))}
            {cells.map((d, i) =>
              d ? (
                <button
                  key={iso(d)}
                  type="button"
                  data-day={iso(d)}
                  className={`datepicker-day${value && sameDay(d, value) ? " is-selected" : ""}${sameDay(d, today) ? " is-today" : ""}`}
                  tabIndex={sameDay(d, focus) ? 0 : -1}
                  disabled={d < min}
                  aria-label={label(d)}
                  aria-pressed={value ? sameDay(d, value) : false}
                  onClick={() => pick(d)}
                >
                  {d.getDate()}
                </button>
              ) : (
                <span key={`blank-${i}`} />
              ),
            )}
          </div>
          <p className="datepicker-hint">The slip ends at the end of this day.</p>
        </div>
      ) : null}
    </div>
  );
}
