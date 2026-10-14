// PayPal webhook signature check - SANDBOX ONLY, done locally (PayPal's
// documented offline method): PayPal signs
//   <transmission id>|<transmission time>|<our webhook ID>|<CRC32 of the raw body>
// with SHA256withRSA, and names its certificate in paypal-cert-url. We fetch
// that certificate only from PayPal's sandbox API hosts over https (cached),
// require it to be PayPal's own (DigiCert-issued), and check
// the signature here. No call to PayPal per delivery, so forged requests cost
// PayPal nothing and cannot use up the shared app's quota.

import "server-only";
import { verify, X509Certificate } from "node:crypto";
import { crc32 } from "node:zlib";

export type Verification = "valid" | "invalid" | "unavailable";

const CERT_TTL_MS = 24 * 3_600_000;
const MAX_CERTS = 16;
const certs = new Map<string, { cert: X509Certificate; at: number }>();

// PayPal's sandbox serves its signing certificates from these hosts, under
// this path only. Anything else is refused before any fetch.
const CERT_HOSTS = new Set(["api.sandbox.paypal.com", "api-m.sandbox.paypal.com"]);
function allowedCertUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !CERT_HOSTS.has(url.hostname) || url.username || url.password || url.port) return null;
    if (!/^\/v1\/notifications\/certs\/[A-Za-z0-9-]{1,100}$/.test(url.pathname)) return null;
    // The query string is not part of a certificate's address (and can't be used to force fetches).
    return new URL(`${url.origin}${url.pathname}`);
  } catch {
    return null;
  }
}

// The certificate must be PayPal's own, issued by DigiCert.
const isPayPalCert = (cert: X509Certificate) =>
  /O=PayPal\\?, Inc\./.test(cert.subject) && /CN=[a-z0-9.-]*paypal\.com$/m.test(cert.subject) && /O=DigiCert Inc/.test(cert.issuer);

async function certificate(url: URL): Promise<X509Certificate | "invalid" | "unavailable"> {
  const hit = certs.get(url.href);
  if (hit && Date.now() - hit.at < CERT_TTL_MS) return hit.cert;
  let res: Response;
  try {
    res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000), cache: "no-store" });
  } catch {
    return "unavailable";
  }
  if (res.status >= 500 || res.status === 429) return "unavailable";
  if (!res.ok) return "invalid";
  const pem = await res.text();
  if (pem.length > 16_384) return "invalid";
  let cert: X509Certificate;
  try {
    cert = new X509Certificate(pem);
  } catch {
    return "invalid";
  }
  const now = Date.now();
  if (Date.parse(cert.validFrom) > now || Date.parse(cert.validTo) < now || !isPayPalCert(cert)) return "invalid";
  if (certs.size >= MAX_CERTS) certs.delete(certs.keys().next().value!);
  certs.set(url.href, { cert, at: now });
  return cert;
}

export async function verifyWebhookSignature(rawBody: string, headers: Headers, webhookId: string): Promise<Verification> {
  const algo = headers.get("paypal-auth-algo");
  const certUrl = allowedCertUrl(headers.get("paypal-cert-url") ?? "");
  if (!certUrl && headers.get("paypal-cert-url")) {
    // Host only (never the body): shows at once if PayPal moves its certificates.
    try {
      console.warn(`[paypal-webhook] certificate address refused: ${new URL(headers.get("paypal-cert-url")!).host}`);
    } catch {
      console.warn("[paypal-webhook] certificate address refused: not a URL");
    }
  }
  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const signature = headers.get("paypal-transmission-sig");
  if (algo !== "SHA256withRSA" || !certUrl || !transmissionId || !transmissionTime || !signature) return "invalid";
  if (transmissionId.length > 128 || transmissionTime.length > 64 || signature.length > 2048 || transmissionId.includes("|") || transmissionTime.includes("|")) return "invalid";

  const cert = await certificate(certUrl);
  if (cert === "invalid" || cert === "unavailable") return cert;

  const message = `${transmissionId}|${transmissionTime}|${webhookId}|${crc32(Buffer.from(rawBody, "utf8"))}`;
  try {
    return verify("RSA-SHA256", Buffer.from(message, "utf8"), cert.publicKey, Buffer.from(signature, "base64")) ? "valid" : "invalid";
  } catch {
    return "invalid";
  }
}
