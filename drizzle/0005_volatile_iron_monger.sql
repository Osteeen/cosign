ALTER TYPE "public"."order_status" ADD VALUE 'CANCELLED';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;