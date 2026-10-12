// The message under a field that needs fixing. Its id matches the field's
// aria-describedby, so screen readers read it with the field.
export function FieldError({ name, errors }: { name: string; errors: Record<string, string> }) {
  const message = errors[name];
  if (!message) return null;
  return (
    <p id={`${name}-error`} className="field-error" role="alert">
      {message}
    </p>
  );
}

// Props to spread on an input so it is marked invalid and linked to its message.
export function invalidProps(name: string, errors: Record<string, string>) {
  return errors[name] ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {};
}
