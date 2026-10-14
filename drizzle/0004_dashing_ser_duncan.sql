CREATE TYPE "public"."order_status" AS ENUM('SENT', 'SEEN', 'SHIPPED');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"label" text NOT NULL,
	"recipient" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"region" text NOT NULL,
	"postal_code" text NOT NULL,
	"country_code" text DEFAULT 'US' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "addresses_id_owner" UNIQUE("id","owner_id"),
	CONSTRAINT "addresses_country_us" CHECK ("addresses"."country_code" = 'US'),
	CONSTRAINT "addresses_region_code" CHECK ("addresses"."region" ~ '^[A-Z]{2}$'),
	CONSTRAINT "addresses_postal_code" CHECK ("addresses"."postal_code" ~ '^[0-9]{5}(-[0-9]{4})?$')
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"agent_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"spend_request_id" uuid NOT NULL,
	"items" jsonb NOT NULL,
	"total_cents" bigint NOT NULL,
	"ship_to" jsonb,
	"status" "order_status" DEFAULT 'SENT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	CONSTRAINT "orders_spend_request_id_unique" UNIQUE("spend_request_id"),
	CONSTRAINT "orders_total_positive" CHECK ("orders"."total_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "slips" ADD COLUMN "ship_to_address_id" uuid;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_spend_owner_fk" FOREIGN KEY ("spend_request_id","owner_id") REFERENCES "public"."spend_requests"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_agent_owner_fk" FOREIGN KEY ("agent_id","owner_id") REFERENCES "public"."agents"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_owner_idx" ON "addresses" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "orders_owner_idx" ON "orders" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_store_idx" ON "orders" USING btree ("store_id","created_at");--> statement-breakpoint
ALTER TABLE "slips" ADD CONSTRAINT "slips_ship_to_owner_fk" FOREIGN KEY ("ship_to_address_id","owner_id") REFERENCES "public"."addresses"("id","owner_id") ON DELETE no action ON UPDATE no action;