import { and, asc, eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { agents } from "@/db/schema";
import { problem, rateLimit, tooMany, clientIp } from "@/lib/api";
import { DEMO_OWNER_ID, demoEnabled, isDemoOwner } from "@/lib/demo/account";
import { runDemoBot } from "@/lib/demo/bot";
import { setAgentPaused } from "@/lib/services/agents";
import { clearStaleDemoApprovals } from "@/lib/services/spend";

// Runs the demo procurement bot for the shared demo account and streams its
// steps as newline-delimited JSON. Demo account only; rate-limited because each
// run calls Claude, Channel3 and the PayPal sandbox.
export async function POST(request: Request) {
  if (!demoEnabled()) return problem(404, "not_found", "Not found.");
  const session = await auth();
  if (!session?.user?.id || !isDemoOwner(session.user.id)) return problem(403, "forbidden", "The demo bot runs in the demo account only.");

  const ip = clientIp(request.headers);
  const perVisitor = rateLimit(`demo-bot:${ip}`, 2, 60_000);
  if (!perVisitor.ok) return tooMany(perVisitor.retryAfter);
  const overall = rateLimit("demo-bot:all", 30, 60 * 60_000);
  if (!overall.ok) return tooMany(overall.retryAfter);

  // The seeded bot: the oldest one with this name (a visitor may add a namesake).
  const [seeded] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.ownerId, DEMO_OWNER_ID), eq(agents.name, "Office procurement bot"), ne(agents.status, "REVOKED")))
    .orderBy(asc(agents.createdAt))
    .limit(1);
  if (!seeded) return problem(409, "no_demo_agent", "The demo agent is not set up.");
  // The account is shared: if an earlier visitor paused the bot, a run resumes
  // it, so the next visitor never finds the demo broken.
  if (seeded.status === "PAUSED") await setAgentPaused(DEMO_OWNER_ID, seeded.id, false);
  await clearStaleDemoApprovals(DEMO_OWNER_ID);
  const agent = { ...seeded, status: "ACTIVE" };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        for await (const event of runDemoBot(agent)) send(event);
      } catch (e) {
        console.error(`[demo-bot] run failed (${e instanceof Error ? e.name : "error"})`);
        send({ t: "done", text: "The demo bot stopped early. Nothing was charged for anything not marked paid." });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
