import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { appUrl, ServiceError } from "@/lib/services/common";
import { completeHoldApproval } from "@/lib/services/slips";

// PayPal sends the owner's browser here after they approve a budget hold.
// The query string is only a pointer: the hold must belong to the signed-in
// owner, and PayPal must confirm the store and amount, before it is placed.
export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[A-Z0-9]{8,32}$/.test(orderId)) return NextResponse.redirect(`${appUrl()}/?notice=hold-invalid`);

  const session = await auth();
  const ownerId = session?.user?.id;
  if (!ownerId) {
    // Not signed in here (e.g. a different browser): PayPal keeps the approval,
    // so sign in and come straight back to finish placing the hold.
    const next = `/api/paypal/hold-return?token=${orderId}`;
    return NextResponse.redirect(`${appUrl()}/sign-in?reason=hold&next=${encodeURIComponent(next)}`);
  }

  try {
    const { agentId } = await completeHoldApproval(ownerId, orderId);
    // Back to the guided flow: it moves on to the next store, or finishes.
    return NextResponse.redirect(`${appUrl()}/agents/${agentId}/holds?notice=hold-approved`);
  } catch (e) {
    const code = e instanceof ServiceError ? e.code : "hold-error";
    if (!(e instanceof ServiceError)) console.error("[hold-return]", e instanceof Error ? e.message : e);
    return NextResponse.redirect(`${appUrl()}/?notice=${encodeURIComponent(code)}`);
  }
}
