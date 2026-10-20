// Client-side form checks in Cosign's own words, replacing the browser's
// built-in bubbles. Uses each field's native constraints (required, min, max,
// type, maxLength) so the rules live in one place: the markup. The server
// still validates everything again; this is only for a friendly first answer.

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function labelFor(el: Field): string {
  const explicit = el.dataset.label;
  if (explicit) return explicit;
  const label = el.id ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`) : null;
  const text = (label?.textContent ?? el.getAttribute("aria-label") ?? el.name).replace(/\(.*?\)/g, "").trim();
  return text.toLowerCase();
}

function messageFor(el: Field): string | null {
  const v = el.validity;
  if (v.valid) return null;
  const what = labelFor(el);
  if (v.valueMissing) return `Enter ${/^[aeiou]/.test(what) ? "an" : "a"} ${what}.`;
  if (v.typeMismatch && el.type === "email") return "Enter a full email address, like name@company.com.";
  if (v.rangeUnderflow || v.rangeOverflow) {
    const min = (el as HTMLInputElement).min;
    const max = (el as HTMLInputElement).max;
    return min && max ? `Enter a number from ${min} to ${max}.` : "Enter a number in the allowed range.";
  }
  if (v.badInput || v.stepMismatch) return "Enter a whole number.";
  if (v.tooLong) return `Keep it under ${(el as HTMLInputElement).maxLength} characters.`;
  if (v.patternMismatch) return el.title || `Check the ${what}.`;
  return `Check the ${what}.`;
}

// Returns errors by field name, and focuses the first invalid field.
export function validateForm(form: HTMLFormElement): Record<string, string> {
  const errors: Record<string, string> = {};
  let first: Field | null = null;
  for (const el of Array.from(form.elements) as Field[]) {
    if (!("validity" in el) || !el.name || el.disabled) continue;
    const msg = messageFor(el);
    if (msg && !errors[el.name]) {
      errors[el.name] = msg;
      first ??= el;
    }
  }
  first?.focus();
  return errors;
}
