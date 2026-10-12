"use client";

import { useId, useRef, type ReactNode } from "react";
import { SubmitButton } from "./submit-button";

// A button that asks before it acts. Either:
// - `action`: the confirm button submits a form to that server action, or
// - `formId`: the confirm button submits another form on the page (used to
//   co-sign a permission slip after reviewing it).
// Native <dialog>: focus is trapped, Escape closes, focus returns to the trigger.
// No click-outside-to-close: a stray click must never dismiss a money decision.
export function ConfirmDialog({
  trigger,
  triggerClassName = "button button-quiet",
  title,
  children,
  confirmLabel,
  pendingLabel,
  action,
  formId,
  tone = "neutral",
  beforeOpen,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  action?: (formData: FormData) => void | Promise<void>;
  formId?: string;
  tone?: "neutral" | "danger";
  // Return false to keep the dialog closed (e.g. the form has errors).
  beforeOpen?: () => boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyClass = `dialog-body${tone === "danger" ? " dialog-danger" : ""}`;
  const confirmClass = tone === "danger" ? "button button-danger" : "button button-primary";
  const close = () => ref.current?.close();

  const content = (
    <>
      <h2 id={titleId} className="dialog-title">
        {title}
      </h2>
      <div className="dialog-text">{children}</div>
      <div className="dialog-actions">
        <button type="button" className="button button-quiet" onClick={close} autoFocus>
          Cancel
        </button>
        {formId ? (
          <button type="submit" form={formId} className={confirmClass} onClick={close}>
            {confirmLabel}
          </button>
        ) : (
          <SubmitButton className={confirmClass} pendingLabel={pendingLabel}>
            {confirmLabel}
          </SubmitButton>
        )}
      </div>
    </>
  );

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => {
          if (beforeOpen && !beforeOpen()) return;
          ref.current?.showModal();
        }}>
        {trigger}
      </button>
      {/* Closes only by its own buttons (or Escape): a click on the backdrop does nothing. */}
      <dialog ref={ref} className="dialog" aria-labelledby={titleId}>
        {formId ? (
          <div className={bodyClass}>{content}</div>
        ) : (
          <form action={action} className={bodyClass}>
            {content}
          </form>
        )}
      </dialog>
    </>
  );
}
