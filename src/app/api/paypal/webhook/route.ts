import { problem, rateLimit, tooMany, clientIp } from "@/lib/api";
import { verifyWebhookSignature } from "@/lib/paypal/webhooks";
import { processPayPalEvent, type PayPalEvent } from "@/lib/services/webhooks";

// PayPal webhook deliveries (register this URL in the PayPal app, sandbox).
// Nothing is trusted until PayPal's signature for our webhook ID checks out.
// Status codes tell PayPal what to do: 2xx = done (also for events that are not
// ours), 400 = not a genuine delivery, 5xx = try again later (PayPal retries
// for up to 3 days). Bodies and headers are never logged.

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return problem(503, "webhook_not_configured", "PayPal webhooks are not configured.");

  // Junk is capped per sender. The address is the LAST x-forwarded-for entry,
  // the one our host's proxy adds (earlier entries are whatever the client
  // sent). Signatures are checked locally, so junk never costs a PayPal call.
  // PayPal's own traffic is far below this; a 429 only makes it deliver later.
  const ip = clientIp(request.headers);
  const perAddress = rateLimit(`paypal-webhook:${ip}`, 120, 60_000);
  if (!perAddress.ok) return tooMany(perAddress.retryAfter);

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return problem(413, "too_large", "Request body is too large.");
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return problem(413, "too_large", "Request body is too large.");

  // Must be one JSON object with an event ID and type.
  let event: PayPalEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return problem(400, "invalid_json", "Body is not JSON.");
  }
  if (!event || typeof event !== "object" || Array.isArray(event) || typeof event.id !== "string" || typeof event.event_type !== "string" || event.id.length > 64 || event.event_type.length > 64) {
    return problem(400, "invalid_event", "Not a PayPal event.");
  }

  const verification = await verifyWebhookSignature(raw, request.headers, webhookId);
  if (verification === "unavailable") return problem(503, "verification_unavailable", "Could not verify the signature right now.");
  if (verification === "invalid") return problem(400, "invalid_signature", "Signature not verified.");

  try {
    const { duplicate, outcome } = await processPayPalEvent(event);
    console.log(`[paypal-webhook] ${event.event_type} ${duplicate ? "duplicate" : outcome}`);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error(`[paypal-webhook] ${event.event_type} failed: ${e instanceof Error ? e.name : "error"}`);
    return problem(500, "processing_failed", "Could not process the event; PayPal will retry.");
  }
}
