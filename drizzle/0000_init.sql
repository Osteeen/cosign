CREATE TYPE "public"."agent_status" AS ENUM('ACTIVE', 'PAUSED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."hold_status" AS ENUM('AWAITING_APPROVAL', 'ACTIVE', 'RELEASED', 'EXPIRED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."slip_status" AS ENUM('AWAITING_HOLDS', 'ACTIVE', 'ENDED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."spend_status" AS ENUM('PROCESSING', 'COMPLETED', 'PENDING_APPROVAL', 'DENIED', 'APPROVAL_EXPIRED', 'PAYMENT_FAILED');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"agent_id" uuid,
	"spend_request_id" uuid,
	"type" text NOT NULL,
	"amount_cents" bigint,
	"currency" text,
	"summary" text NOT NULL,
	"data" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "agent_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "agents_id_owner" UNIQUE("id","owner_id")
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"spend_request_id" uuid NOT NULL,
	"status" "approval_status" DEFAULT 'PENDING' NOT NULL,
	"cart_hash" text NOT NULL,
	"total_cents" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approvals_spend_request_id_unique" UNIQUE("spend_request_id")
);
--> statement-breakpoint
CREATE TABLE "holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"slip_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"period_index" integer NOT NULL,
	"status" "hold_status" DEFAULT 'AWAITING_APPROVAL' NOT NULL,
	"amount_cents" bigint NOT NULL,
	"captured_cents" bigint DEFAULT 0 NOT NULL,
	"reserved_cents" bigint DEFAULT 0 NOT NULL,
	"paypal_order_id" text,
	"paypal_authorization_id" text,
	"authorized_at" timestamp with time zone,
	"honor_period_ends_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone,
	CONSTRAINT "holds_paypal_order_id_unique" UNIQUE("paypal_order_id"),
	CONSTRAINT "holds_paypal_authorization_id_unique" UNIQUE("paypal_authorization_id"),
	CONSTRAINT "holds_id_owner" UNIQUE("id","owner_id"),
	CONSTRAINT "holds_amount_positive" CHECK ("holds"."amount_cents" > 0),
	CONSTRAINT "holds_nonneg" CHECK ("holds"."captured_cents" >= 0 and "holds"."reserved_cents" >= 0),
	CONSTRAINT "holds_within_amount" CHECK ("holds"."captured_cents" + "holds"."reserved_cents" <= "holds"."amount_cents")
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"owner_id" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" integer,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_owner_id_key_pk" PRIMARY KEY("owner_id","key")
);
--> statement-breakpoint
CREATE TABLE "paypal_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"verified" boolean NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slip_stores" (
	"slip_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"allocation_cents" bigint NOT NULL,
	CONSTRAINT "slip_stores_slip_id_store_id_pk" PRIMARY KEY("slip_id","store_id"),
	CONSTRAINT "slip_stores_allocation_positive" CHECK ("slip_stores"."allocation_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "slips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"agent_id" uuid NOT NULL,
	"status" "slip_status" DEFAULT 'AWAITING_HOLDS' NOT NULL,
	"rule_version" integer DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"period_days" integer NOT NULL,
	"period_budget_cents" bigint NOT NULL,
	"per_purchase_max_cents" bigint NOT NULL,
	"approve_above_cents" bigint NOT NULL,
	"categories" text[] NOT NULL,
	"expires_at" timestamp with time zone,
	"source_text" text NOT NULL,
	"current_period_index" integer DEFAULT 0 NOT NULL,
	"current_period_starts_at" timestamp with time zone NOT NULL,
	"current_period_ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "slips_id_owner" UNIQUE("id","owner_id"),
	CONSTRAINT "slips_currency_usd" CHECK ("slips"."currency" = 'USD'),
	CONSTRAINT "slips_period_days" CHECK ("slips"."period_days" between 1 and 28),
	CONSTRAINT "slips_budget_positive" CHECK ("slips"."period_budget_cents" > 0),
	CONSTRAINT "slips_max_positive" CHECK ("slips"."per_purchase_max_cents" > 0),
	CONSTRAINT "slips_approve_nonneg" CHECK ("slips"."approve_above_cents" >= 0),
	CONSTRAINT "slips_period_order" CHECK ("slips"."current_period_ends_at" > "slips"."current_period_starts_at")
);
--> statement-breakpoint
CREATE TABLE "spend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"agent_id" uuid NOT NULL,
	"slip_id" uuid,
	"store_id" uuid NOT NULL,
	"hold_id" uuid,
	"items" jsonb NOT NULL,
	"total_cents" bigint NOT NULL,
	"currency" text NOT NULL,
	"purpose" text NOT NULL,
	"cart_hash" text NOT NULL,
	"status" "spend_status" NOT NULL,
	"decision" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"approval_expires_at" timestamp with time zone,
	"paypal_capture_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spend_requests_paypal_capture_id_unique" UNIQUE("paypal_capture_id"),
	CONSTRAINT "spend_requests_id_owner" UNIQUE("id","owner_id"),
	CONSTRAINT "spend_total_positive" CHECK ("spend_requests"."total_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"categories" text[] NOT NULL,
	"website" text,
	"paypal_merchant_id" text NOT NULL,
	"paypal_tracking_id" text NOT NULL,
	"payments_receivable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_paypal_merchant_id_unique" UNIQUE("paypal_merchant_id"),
	CONSTRAINT "stores_paypal_tracking_id_unique" UNIQUE("paypal_tracking_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_agent_owner_fk" FOREIGN KEY ("agent_id","owner_id") REFERENCES "public"."agents"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_spend_owner_fk" FOREIGN KEY ("spend_request_id","owner_id") REFERENCES "public"."spend_requests"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_keys" ADD CONSTRAINT "agent_keys_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_keys" ADD CONSTRAINT "agent_keys_agent_owner_fk" FOREIGN KEY ("agent_id","owner_id") REFERENCES "public"."agents"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_spend_owner_fk" FOREIGN KEY ("spend_request_id","owner_id") REFERENCES "public"."spend_requests"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_slip_owner_fk" FOREIGN KEY ("slip_id","owner_id") REFERENCES "public"."slips"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_slip_store_fk" FOREIGN KEY ("slip_id","store_id") REFERENCES "public"."slip_stores"("slip_id","store_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slip_stores" ADD CONSTRAINT "slip_stores_slip_id_slips_id_fk" FOREIGN KEY ("slip_id") REFERENCES "public"."slips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slip_stores" ADD CONSTRAINT "slip_stores_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slips" ADD CONSTRAINT "slips_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slips" ADD CONSTRAINT "slips_agent_owner_fk" FOREIGN KEY ("agent_id","owner_id") REFERENCES "public"."agents"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_requests" ADD CONSTRAINT "spend_requests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_requests" ADD CONSTRAINT "spend_requests_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_requests" ADD CONSTRAINT "spend_requests_agent_owner_fk" FOREIGN KEY ("agent_id","owner_id") REFERENCES "public"."agents"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_requests" ADD CONSTRAINT "spend_requests_slip_owner_fk" FOREIGN KEY ("slip_id","owner_id") REFERENCES "public"."slips"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_requests" ADD CONSTRAINT "spend_requests_hold_owner_fk" FOREIGN KEY ("hold_id","owner_id") REFERENCES "public"."holds"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_owner_time_idx" ON "activity_events" USING btree ("owner_id","occurred_at");--> statement-breakpoint
CREATE INDEX "agent_keys_agent_idx" ON "agent_keys" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agents_owner_idx" ON "agents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "approvals_owner_status_idx" ON "approvals" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "holds_owner_idx" ON "holds" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "holds_one_live_per_store_period" ON "holds" USING btree ("slip_id","store_id","period_index") WHERE "holds"."status" in ('AWAITING_APPROVAL', 'ACTIVE');--> statement-breakpoint
CREATE INDEX "slips_owner_idx" ON "slips" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slips_one_live_per_agent" ON "slips" USING btree ("agent_id") WHERE "slips"."status" in ('AWAITING_HOLDS', 'ACTIVE');--> statement-breakpoint
CREATE UNIQUE INDEX "spend_requests_agent_idem" ON "spend_requests" USING btree ("agent_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "spend_requests_owner_idx" ON "spend_requests" USING btree ("owner_id","created_at");