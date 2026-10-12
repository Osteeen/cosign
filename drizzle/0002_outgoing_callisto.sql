ALTER TABLE "holds" ADD COLUMN "paypal_current_authorization_id" text;--> statement-breakpoint
ALTER TABLE "spend_requests" ADD COLUMN "capture_authorization_id" text;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_paypal_current_authorization_id_unique" UNIQUE("paypal_current_authorization_id");