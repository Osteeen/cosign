import { timingSafeEqual } from "node:crypto";
import { problem } from "@/lib/api";
import { runDailyJob } from "@/lib/services/jobs";

// Called once a day by a scheduler (a Railway cron service) with
//   Authorization: Bearer <JOB_SECRET>
// Anyone without the secret gets 401 and nothing runs.
export async function POST(request: Request) {
  const secret = process.env.JOB_SECRET;
  if (!secret || secret.length < 32) return problem(503, "job_not_configured", "Scheduled jobs are not configured.");
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return problem(401, "unauthorized", "Missing or wrong job secret.");
  }
  const result = await runDailyJob();
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
