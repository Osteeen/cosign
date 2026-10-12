import type { CSSProperties, ReactNode } from "react";

export interface SlipRow {
  label: string;
  value: ReactNode;
}

// A permission slip: a perforated form sheet with typed rules and a
// signature line where the owner co-signs. Rows carry their position (--i) so
// the opening animation can type them in one after another.
export function Slip({
  tag,
  rows,
  signedBy,
  signedOn,
  className,
}: {
  tag: string;
  rows: SlipRow[];
  signedBy: string;
  signedOn: string;
  className?: string;
}) {
  const at = (i: number) => ({ "--i": i }) as CSSProperties;
  return (
    <article className={className ? `slip ${className}` : "slip"} aria-label="Permission slip">
      <header className="slip-head" style={at(0)}>
        <span className="slip-title">Permission slip</span>
        <span className="slip-tag">{tag}</span>
      </header>
      <dl className="slip-rows">
        {rows.map((row, i) => (
          <div className="slip-row" key={row.label} style={at(i + 1)}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <footer className="signature">
        <div>
          <div className="signature-line">
            <span className="signature-ink" style={{ "--sign-delay": `${600 + (rows.length + 1) * 110 + 150}ms` } as CSSProperties}>
              {signedBy}
            </span>
          </div>
          <p className="signature-caption">Co-signed by the owner</p>
        </div>
        <p className="signature-date">{signedOn}</p>
      </footer>
    </article>
  );
}
