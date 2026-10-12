// Sign-in email for owners, styled like a Cosign slip: a form card with a
// perforated top edge, typed details and one ballpoint-blue button.
// Email-safe: tables, inline styles, system fonts, no images, no tracking.

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const INK = "#16213a";
const INK_SOFT = "#4b5672";
const RULE = "#d3d9e3";
const PAPER = "#eef1f5";
const SHEET = "#fbfcfd";
const BALLPOINT = "#2343c8";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";

function detailRow(label: string, value: string): string {
  return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid ${RULE};font:600 11px/1.4 ${SANS};letter-spacing:0.08em;text-transform:uppercase;color:${INK_SOFT};width:120px;vertical-align:top">${label}</td>
  <td style="padding:10px 0;border-bottom:1px solid ${RULE};font:14px/1.4 ${MONO};color:${INK};vertical-align:top">${value}</td>
</tr>`;
}

export function signInEmail(url: string, email: string): { subject: string; html: string; text: string } {
  const safeUrl = escapeHtml(url);
  const safeEmail = escapeHtml(email);
  const subject = "Your Cosign sign-in link";

  const text = [
    "Sign in to Cosign",
    "",
    `Use this link to sign in as ${email}:`,
    url,
    "",
    "It works once and expires in 15 minutes.",
    "Did not ask for this? Ignore this email - nobody can sign in without the link.",
    "",
    "Cosign sandbox - no real money moves.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAPER}">Your one-time link to sign in to Cosign. It expires in 15 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
    <tr><td style="padding:0 4px 18px;">
      <span style="font:800 22px/1 ${SANS};letter-spacing:-0.02em;color:${INK};border-bottom:2px solid ${BALLPOINT};padding-bottom:3px;">Cosign</span>
    </td></tr>
    <tr><td style="background:${SHEET};border-top:3px dotted ${RULE};border-radius:0 0 6px 6px;padding:28px 28px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding-bottom:12px;border-bottom:1.5px solid ${INK};font:800 12px/1 ${SANS};letter-spacing:0.16em;text-transform:uppercase;color:${INK};">Sign-in link</td></tr>
        <tr><td style="padding:20px 0 6px;font:700 24px/1.2 ${SANS};color:${INK};">Sign in to Cosign</td></tr>
        <tr><td style="padding:0 0 22px;font:15px/1.55 ${SANS};color:${INK_SOFT};">Press the button to sign in. No password needed.</td></tr>
        <tr><td style="padding:0 0 24px;">
          <a href="${safeUrl}" style="display:inline-block;background:${BALLPOINT};color:#ffffff;font:700 15px/1 ${SANS};text-decoration:none;padding:14px 22px;border-radius:6px;">Sign in to Cosign</a>
        </td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${detailRow("For", safeEmail)}
            ${detailRow("Expires", "In 15 minutes")}
            ${detailRow("Works", "Once")}
          </table>
        </td></tr>
        <tr><td style="padding:20px 0 0;font:13px/1.55 ${SANS};color:${INK_SOFT};">
          Did not ask for this? Ignore this email - nobody can sign in without the link.
        </td></tr>
        <tr><td style="padding:14px 0 0;font:12px/1.5 ${SANS};color:${INK_SOFT};">
          Button not working? Paste this into your browser:<br>
          <a href="${safeUrl}" style="color:${BALLPOINT};word-break:break-all;font:12px/1.5 ${MONO};">${safeUrl}</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:18px 4px 0;font:12px/1.5 ${MONO};color:${INK_SOFT};">Cosign sandbox - no real money moves</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}
