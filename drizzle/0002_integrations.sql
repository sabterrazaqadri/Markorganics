CREATE TYPE "public"."integration_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."wa_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."wa_message_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed', 'skipped', 'received');--> statement-breakpoint
CREATE TABLE "cod_remittance_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remittance_id" uuid NOT NULL,
	"shipment_id" uuid,
	"order_id" uuid,
	"tracking_number" text DEFAULT '' NOT NULL,
	"expected_paisa" integer DEFAULT 0 NOT NULL,
	"paid_paisa" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cod_remittances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"paid_on" timestamp with time zone DEFAULT now() NOT NULL,
	"amount_paisa" integer DEFAULT 0 NOT NULL,
	"allocated_paisa" integer DEFAULT 0 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courier_cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"mark_city" text NOT NULL,
	"courier_city_id" text NOT NULL,
	"courier_city_name" text DEFAULT '' NOT NULL,
	"confirmed_by_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"direction" "integration_direction" DEFAULT 'outbound' NOT NULL,
	"operation" text DEFAULT '' NOT NULL,
	"method" text DEFAULT 'GET' NOT NULL,
	"endpoint" text DEFAULT '' NOT NULL,
	"request_body" jsonb,
	"request_headers" jsonb,
	"response_status" integer,
	"response_body" jsonb,
	"ok" boolean DEFAULT false NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"error" text,
	"job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"provider" text PRIMARY KEY NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secrets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_test_at" timestamp with time zone,
	"last_test_ok" boolean,
	"last_test_message" text,
	"last_error_at" timestamp with time zone,
	"last_error_message" text,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_key" text,
	"last_error" text,
	"result" jsonb,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"raw_status" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'poll' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"tracking_number" text NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"raw_status" text DEFAULT '' NOT NULL,
	"label_url" text,
	"pickup_address_code" text DEFAULT '' NOT NULL,
	"courier_city_id" text DEFAULT '' NOT NULL,
	"cod_amount_paisa" integer DEFAULT 0 NOT NULL,
	"remitted_paisa" integer DEFAULT 0 NOT NULL,
	"remittance_id" uuid,
	"booked_by_id" uuid,
	"booked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" "wa_direction" DEFAULT 'outbound' NOT NULL,
	"phone" text NOT NULL,
	"customer_id" uuid,
	"order_id" uuid,
	"template_name" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'utility' NOT NULL,
	"trigger" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"wamid" text,
	"status" "wa_message_status" DEFAULT 'queued' NOT NULL,
	"error" text,
	"billable" boolean DEFAULT true NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"category" text DEFAULT 'utility' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"variables" text[] DEFAULT '{}'::text[] NOT NULL,
	"approval_status" text DEFAULT 'local' NOT NULL,
	"trigger" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cod_remittance_lines" ADD CONSTRAINT "cod_remittance_lines_remittance_id_cod_remittances_id_fk" FOREIGN KEY ("remittance_id") REFERENCES "public"."cod_remittances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_remittance_lines" ADD CONSTRAINT "cod_remittance_lines_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_remittance_lines" ADD CONSTRAINT "cod_remittance_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_remittances" ADD CONSTRAINT "cod_remittances_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courier_cities" ADD CONSTRAINT "courier_cities_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_booked_by_id_users_id_fk" FOREIGN KEY ("booked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cod_remittance_lines_pair_idx" ON "cod_remittance_lines" USING btree ("remittance_id","tracking_number");--> statement-breakpoint
CREATE INDEX "cod_remittance_lines_shipment_idx" ON "cod_remittance_lines" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "cod_remittances_provider_idx" ON "cod_remittances" USING btree ("provider","paid_on");--> statement-breakpoint
CREATE UNIQUE INDEX "courier_cities_pair_idx" ON "courier_cities" USING btree ("provider","mark_city");--> statement-breakpoint
CREATE INDEX "courier_cities_provider_idx" ON "courier_cities" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "integration_events_provider_idx" ON "integration_events" USING btree ("provider","created_at");--> statement-breakpoint
CREATE INDEX "integration_events_created_idx" ON "integration_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "integration_events_ok_idx" ON "integration_events" USING btree ("ok","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_idempotency_idx" ON "jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "jobs" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_created_idx" ON "jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_events_dedupe_idx" ON "shipment_events" USING btree ("shipment_id","raw_status","occurred_at");--> statement-breakpoint
CREATE INDEX "shipment_events_shipment_idx" ON "shipment_events" USING btree ("shipment_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_tracking_idx" ON "shipments" USING btree ("provider","tracking_number");--> statement-breakpoint
CREATE INDEX "shipments_order_idx" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "shipments_status_idx" ON "shipments" USING btree ("status","last_sync_at");--> statement-breakpoint
CREATE INDEX "shipments_provider_idx" ON "shipments" USING btree ("provider","booked_at");--> statement-breakpoint
CREATE INDEX "shipments_delivered_idx" ON "shipments" USING btree ("delivered_at");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_phone_idx" ON "whatsapp_messages" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_customer_idx" ON "whatsapp_messages" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_order_idx" ON "whatsapp_messages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_unread_idx" ON "whatsapp_messages" USING btree ("direction","is_read");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_cost_idx" ON "whatsapp_messages" USING btree ("direction","category","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_wamid_idx" ON "whatsapp_messages" USING btree ("wamid");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_templates_name_idx" ON "whatsapp_templates" USING btree ("name","language");--> statement-breakpoint
CREATE INDEX "whatsapp_templates_trigger_idx" ON "whatsapp_templates" USING btree ("trigger");