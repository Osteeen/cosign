"use client";

import { useActionState, useState } from "react";
import { validateForm } from "@/lib/client/validate";
import { saveAddressAction, type AddressFormState } from "@/app/actions";
import { FieldError, invalidProps } from "./field-error";
import { SubmitButton } from "./submit-button";

export type AddressValues = { id?: string; label: string; recipient: string; line1: string; line2: string; city: string; region: string; postal_code: string };

const EMPTY: AddressValues = { label: "", recipient: "", line1: "", line2: "", city: "", region: "", postal_code: "" };

// Add or edit one address. US addresses only for now; PO boxes are fine.
export function AddressForm({ initial = EMPTY, back, submitLabel }: { initial?: AddressValues; back: string; submitLabel: string }) {
  const [state, formAction] = useActionState<AddressFormState, FormData>(saveAddressAction, { status: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const key = initial.id ?? "new";

  return (
    <form
      action={formAction}
      className="slip panel-stack"
      noValidate
      onSubmit={(e) => {
        const found = validateForm(e.currentTarget);
        setErrors(found);
        if (Object.keys(found).length) e.preventDefault();
      }}
      onInput={(e) => {
        const name = (e.target as HTMLInputElement).name;
        if (errors[name]) setErrors({ ...errors, [name]: "" });
      }}
    >
      {initial.id ? <input type="hidden" name="addressId" value={initial.id} /> : null}
      <input type="hidden" name="back" value={back} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor={`label-${key}`} className="field-label">
            Label
          </label>
          <input id={`label-${key}`} name="label" className="field-input" required maxLength={40} defaultValue={initial.label} placeholder="Office" autoComplete="off" data-label="label" {...invalidProps("label", errors)} />
          <p className="field-help">The only part your agents see.</p>
          <FieldError name="label" errors={errors} />
        </div>
        <div className="field">
          <label htmlFor={`recipient-${key}`} className="field-label">
            Recipient
          </label>
          <input id={`recipient-${key}`} name="recipient" className="field-input" required maxLength={80} defaultValue={initial.recipient} placeholder="Ada Lovelace" autoComplete="name" data-label="recipient name" {...invalidProps("recipient", errors)} />
          <FieldError name="recipient" errors={errors} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`line1-${key}`} className="field-label">
          Street address or PO box
        </label>
        <input id={`line1-${key}`} name="line1" className="field-input" required maxLength={100} defaultValue={initial.line1} placeholder="100 Market St" autoComplete="address-line1" data-label="street address" {...invalidProps("line1", errors)} />
        <FieldError name="line1" errors={errors} />
      </div>
      <div className="field">
        <label htmlFor={`line2-${key}`} className="field-label">
          Suite, floor or unit (optional)
        </label>
        <input id={`line2-${key}`} name="line2" className="field-input" maxLength={100} defaultValue={initial.line2} placeholder="Suite 400" autoComplete="address-line2" />
      </div>
      <div className="form-grid form-grid-3">
        <div className="field">
          <label htmlFor={`city-${key}`} className="field-label">
            City
          </label>
          <input id={`city-${key}`} name="city" className="field-input" required maxLength={60} defaultValue={initial.city} placeholder="San Francisco" autoComplete="address-level2" data-label="city" {...invalidProps("city", errors)} />
          <FieldError name="city" errors={errors} />
        </div>
        <div className="field">
          <label htmlFor={`region-${key}`} className="field-label">
            State
          </label>
          <input
            id={`region-${key}`}
            name="region"
            className="field-input field-input-short"
            required
            maxLength={2}
            pattern="[A-Za-z]{2}"
            title="Use the two-letter state code, like CA."
            defaultValue={initial.region}
            placeholder="CA"
            autoComplete="address-level1"
            data-label="state"
            style={{ textTransform: "uppercase" }}
            {...invalidProps("region", errors)}
          />
          <FieldError name="region" errors={errors} />
        </div>
        <div className="field">
          <label htmlFor={`postal-${key}`} className="field-label">
            ZIP code
          </label>
          <input
            id={`postal-${key}`}
            name="postal_code"
            className="field-input"
            required
            inputMode="numeric"
            maxLength={10}
            pattern="[0-9]{5}(-[0-9]{4})?"
            title="Use a 5-digit ZIP code, like 94105 or 94105-1234."
            defaultValue={initial.postal_code}
            placeholder="94105"
            autoComplete="postal-code"
            data-label="ZIP code"
            {...invalidProps("postal_code", errors)}
          />
          <FieldError name="postal_code" errors={errors} />
        </div>
      </div>
      <p className="field-help">US addresses only for now. Stores get this address with each paid order and see it in PayPal.</p>
      {state.status === "error" ? (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton pendingLabel="Saving">{submitLabel}</SubmitButton>
    </form>
  );
}
