import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { agents } from "@/db/schema";
import { problem, rateLimit, tooMany } from "@/lib/api";
import { DEMO_OWNER_ID, demoEnabled, isDemoOwner } from "@/lib/demo/account";
import { runDemoBot } from "@/lib/demo/bot";

// Runs the demo procurement bot for the shared demo account and streams its
// steps as newline-delimited JSON. Demo account only; rate-limited because each
// run calls Claude, Channel3 and the PayPal sandbox.
export async function POST(request: Request) {
  if (!demoEnabled()) return problem(404, "not_found", "Not found.");
  const session = await auth();
  if (!session?.user?.id || !isDemoOwner(session.user.id)) return problem(403, "forbidden", "The demo bot runs in the demo account only.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const perVisitor = rateLimit(`demo-bot:${ip}`, 2, 60_000);
  if (!perVisitor.ok) return tooMany(perVisitor.retryAfter);
  const overall = rateLimit("demo-bot:all", 30, 60 * 60_000);
  if (!overall.ok) return tooMany(overall.retryAfter);

  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.ownerId, DEMO_OWNER_ID), eq(agents.name, "Office procurement bot"), eq(agents.status, "ACTIVE")));
  if (!agent) return problem(409, "no_demo_agent", "The demo agent is not set up.");

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
