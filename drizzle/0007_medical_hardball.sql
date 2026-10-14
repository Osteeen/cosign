ALTER TABLE "holds" ADD COLUMN "frozen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "spend_requests" ADD COLUMN "capture_lease_until" timestamp with time zone;