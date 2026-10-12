// Shared slip-style shell for Cosign emails (matches the sign-in email):
// a form card with a dotted perforated top, typed detail rows and one button.
// Email-safe: tables, inline styles, system fonts, no images, no tracking.

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const INK = "#16213a";
const INK_SOFT = "#4b5672";
const RULE = "#d3d9e3";
const PAPER = "#eef1f5";
const SHEET = "#fbfcfd";
const BALLPOINT = "#2343c8";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";

export function emailLayout(opts: {
  preheader: string;
  header: string;
  title: string;
  intro: string;
  rows: [label: string, value: string][];
  button: { label: string; url: string };
  footnote: string;
}): string {
  const rows = opts.rows
    .map(
      ([label, value]) => `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${RULE};font:600 11px/1.4 ${SANS};letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};width:120px;vertical-align:top">${escapeHtml(label)}</td>
  <td style="padding:10px 0;border-bottom:1px solid ${RULE};font:14px/1.4 ${MONO};color:${INK};vertical-align:top">${escapeHtml(value)}</td>
</tr>`,
    )
    .join("");
  const url = escapeHtml(opts.button.url);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAPER}">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
  <tr><td style="padding:0 4px 18px;"><span style="font:800 22px/1 ${SANS};letter-spacing:-0.02em;color:${INK};border-bottom:2px solid ${BALLPOINT};padding-bottom:3px;">Cosign</span></td></tr>
  <tr><td style="background:${SHEET};border-top:3px dotted ${RULE};border-radius:0 0 6px 6px;padding:28px 28px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding-bottom:12px;border-bottom:1.5px solid ${INK};font:800 12px/1 ${SANS};letter-spacing:0.16em;text-transform:uppercase;color:${INK};">${escapeHtml(opts.header)}</td></tr>
      <tr><td style="padding:20px 0 6px;font:700 22px/1.25 ${SANS};color:${INK};">${escapeHtml(opts.title)}</td></tr>
      <tr><td style="padding:0 0 20px;font:15px/1.55 ${SANS};color:${INK_SOFT};">${escapeHtml(opts.intro)}</td></tr>
      <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>
      <tr><td style="padding:24px 0 0;"><a href="${url}" style="display:inline-block;background:${BALLPOINT};color:#ffffff;font:700 15px/1 ${SANS};text-decoration:none;padding:14px 22px;border-radius:6px;">${escapeHtml(opts.button.label)}</a></td></tr>
      <tr><td style="padding:18px 0 0;font:13px/1.55 ${SANS};color:${INK_SOFT};">${escapeHtml(opts.footnote)}</td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:18px 4px 0;font:12px/1.5 ${MONO};color:${INK_SOFT};">Cosign sandbox - no real money moves</td></tr>
</table></td></tr></table></body></html>`;
}
