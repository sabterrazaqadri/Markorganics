CREATE TYPE "public"."expense_category" AS ENUM('ad_spend', 'delivery', 'other');--> statement-breakpoint
CREATE TABLE "expense_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount_paisa" integer NOT NULL,
	"occurred_on" timestamp with time zone NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD COLUMN "unit_cost_paisa" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "unit_cost_paisa" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "avg_cost_paisa" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_entries_occurred_idx" ON "expense_entries" USING btree ("occurred_on");