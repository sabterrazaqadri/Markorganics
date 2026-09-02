CREATE TYPE "public"."abandoned_status" AS ENUM('open', 'recovered', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."collection_type" AS ENUM('manual', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."discount_applies_to" AS ENUM('order', 'products', 'collections');--> statement-breakpoint
CREATE TYPE "public"."discount_method" AS ENUM('code', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed_amount', 'free_delivery', 'buy_x_get_y');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('open', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."inventory_reason" AS ENUM('recount', 'damaged', 'received', 'correction', 'theft', 'sale', 'restock', 'order_edit');--> statement-breakpoint
CREATE TYPE "public"."menu_handle" AS ENUM('header', 'footer');--> statement-breakpoint
CREATE TYPE "public"."metafield_type" AS ENUM('text', 'number', 'rich_text', 'boolean', 'file');--> statement-breakpoint
CREATE TYPE "public"."order_event_type" AS ENUM('created', 'status', 'note', 'edit', 'tag', 'discount', 'customer');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'draft', 'archived');--> statement-breakpoint
CREATE TYPE "public"."rule_match" AS ENUM('all', 'any');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'manager', 'staff');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "abandoned_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_key" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"cart" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"subtotal_paisa" integer DEFAULT 0 NOT NULL,
	"status" "abandoned_status" DEFAULT 'open' NOT NULL,
	"recovered_order_id" uuid,
	"customer_id" uuid,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_email" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"entity_label" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"cover_image" text DEFAULT '' NOT NULL,
	"author_name" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"seo_title" text DEFAULT '' NOT NULL,
	"seo_description" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" "collection_type" DEFAULT 'manual' NOT NULL,
	"rules_match" "rule_match" DEFAULT 'all' NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"seo_title" text DEFAULT '' NOT NULL,
	"seo_description" text DEFAULT '' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"rules_match" "rule_match" DEFAULT 'all' NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text,
	"city" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"internal_note" text DEFAULT '' NOT NULL,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"cancelled_count" integer DEFAULT 0 NOT NULL,
	"returned_count" integer DEFAULT 0 NOT NULL,
	"total_spent_paisa" integer DEFAULT 0 NOT NULL,
	"avg_order_paisa" integer DEFAULT 0 NOT NULL,
	"first_order_at" timestamp with time zone,
	"last_order_at" timestamp with time zone,
	"merged_into_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"order_id" uuid,
	"customer_id" uuid,
	"phone" text DEFAULT '' NOT NULL,
	"amount_paisa" integer DEFAULT 0 NOT NULL,
	"order_total_paisa" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"role" text DEFAULT 'applies' NOT NULL,
	"product_id" uuid,
	"collection_id" uuid
);
--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"code" text,
	"method" "discount_method" DEFAULT 'code' NOT NULL,
	"type" "discount_type" DEFAULT 'percentage' NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"applies_to" "discount_applies_to" DEFAULT 'order' NOT NULL,
	"min_subtotal_paisa" integer DEFAULT 0 NOT NULL,
	"min_quantity" integer DEFAULT 0 NOT NULL,
	"first_time_only" boolean DEFAULT false NOT NULL,
	"segment_id" uuid,
	"usage_limit" integer,
	"once_per_customer" boolean DEFAULT false NOT NULL,
	"buy_quantity" integer DEFAULT 0 NOT NULL,
	"get_quantity" integer DEFAULT 0 NOT NULL,
	"get_discount_bp" integer DEFAULT 10000 NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"revenue_paisa" integer DEFAULT 0 NOT NULL,
	"discounted_paisa" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_order_id" uuid NOT NULL,
	"variant_id" uuid,
	"product_slug" text DEFAULT '' NOT NULL,
	"product_name" text NOT NULL,
	"variant_label" text DEFAULT '' NOT NULL,
	"sku" text DEFAULT '' NOT NULL,
	"unit_price_paisa" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"line_total_paisa" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"status" "draft_status" DEFAULT 'open' NOT NULL,
	"customer_id" uuid,
	"customer_name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"alt_phone" text,
	"city" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"notes" text,
	"internal_note" text,
	"subtotal_paisa" integer DEFAULT 0 NOT NULL,
	"discount_paisa" integer DEFAULT 0 NOT NULL,
	"discount_reason" text,
	"delivery_paisa" integer DEFAULT 0 NOT NULL,
	"total_paisa" integer DEFAULT 0 NOT NULL,
	"converted_order_id" uuid,
	"created_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"resulting_stock" integer NOT NULL,
	"reason" "inventory_reason" NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"user_id" uuid,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text DEFAULT 'image/webp' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"alt" text DEFAULT '' NOT NULL,
	"uploaded_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_id" uuid NOT NULL,
	"parent_id" uuid,
	"label" text NOT NULL,
	"url" text DEFAULT '/' NOT NULL,
	"resource_type" text DEFAULT 'custom' NOT NULL,
	"resource_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" "menu_handle" NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metafield_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text DEFAULT 'product' NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"type" "metafield_type" DEFAULT 'text' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metafield_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"owner_type" text DEFAULT 'product' NOT NULL,
	"owner_id" uuid NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"seo_title" text DEFAULT '' NOT NULL,
	"seo_description" text DEFAULT '' NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"resource" text NOT NULL,
	"name" text NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "order_events_order_idx";--> statement-breakpoint
ALTER TABLE "order_events" ALTER COLUMN "to_status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN "type" "order_event_type" DEFAULT 'status' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN "meta" jsonb;--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "order_events" ADD COLUMN "user_name" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "discount_paisa" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_paisa" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "item_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_actor_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "draft_order_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "return_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "barcode" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "low_stock_threshold" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "status" "product_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_type" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vendor" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seo_title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "seo_description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "abandoned_checkouts" ADD CONSTRAINT "abandoned_checkouts_recovered_order_id_orders_id_fk" FOREIGN KEY ("recovered_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abandoned_checkouts" ADD CONSTRAINT "abandoned_checkouts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_targets" ADD CONSTRAINT "discount_targets_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_targets" ADD CONSTRAINT "discount_targets_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_targets" ADD CONSTRAINT "discount_targets_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_segment_id_customer_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."customer_segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_order_items" ADD CONSTRAINT "draft_order_items_draft_order_id_draft_orders_id_fk" FOREIGN KEY ("draft_order_id") REFERENCES "public"."draft_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_order_items" ADD CONSTRAINT "draft_order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD CONSTRAINT "draft_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD CONSTRAINT "draft_orders_converted_order_id_orders_id_fk" FOREIGN KEY ("converted_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_orders" ADD CONSTRAINT "draft_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menu_id_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metafield_values" ADD CONSTRAINT "metafield_values_definition_id_metafield_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."metafield_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "abandoned_checkouts_session_idx" ON "abandoned_checkouts" USING btree ("session_key");--> statement-breakpoint
CREATE INDEX "abandoned_checkouts_status_idx" ON "abandoned_checkouts" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "abandoned_checkouts_phone_idx" ON "abandoned_checkouts" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_idx" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_posts_published_idx" ON "blog_posts" USING btree ("status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_products_pair_idx" ON "collection_products" USING btree ("collection_id","product_id");--> statement-breakpoint
CREATE INDEX "collection_products_product_idx" ON "collection_products" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_slug_idx" ON "collections" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "collections_type_idx" ON "collections" USING btree ("type");--> statement-breakpoint
CREATE INDEX "customer_segments_name_idx" ON "customer_segments" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "customers_city_idx" ON "customers" USING btree ("city");--> statement-breakpoint
CREATE INDEX "customers_spent_idx" ON "customers" USING btree ("total_spent_paisa");--> statement-breakpoint
CREATE INDEX "customers_last_order_idx" ON "customers" USING btree ("last_order_at");--> statement-breakpoint
CREATE INDEX "customers_orders_count_idx" ON "customers" USING btree ("orders_count");--> statement-breakpoint
CREATE INDEX "discount_redemptions_discount_idx" ON "discount_redemptions" USING btree ("discount_id");--> statement-breakpoint
CREATE INDEX "discount_redemptions_phone_idx" ON "discount_redemptions" USING btree ("discount_id","phone");--> statement-breakpoint
CREATE INDEX "discount_targets_discount_idx" ON "discount_targets" USING btree ("discount_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discounts_code_idx" ON "discounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "discounts_method_idx" ON "discounts" USING btree ("method");--> statement-breakpoint
CREATE INDEX "discounts_enabled_idx" ON "discounts" USING btree ("is_enabled","starts_at");--> statement-breakpoint
CREATE INDEX "draft_order_items_draft_idx" ON "draft_order_items" USING btree ("draft_order_id");--> statement-breakpoint
CREATE INDEX "draft_orders_status_idx" ON "draft_orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "draft_orders_phone_idx" ON "draft_orders" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_variant_idx" ON "inventory_adjustments" USING btree ("variant_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_created_idx" ON "inventory_adjustments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "login_attempts_scope_idx" ON "login_attempts" USING btree ("scope","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_files_url_idx" ON "media_files" USING btree ("url");--> statement-breakpoint
CREATE INDEX "media_files_created_idx" ON "media_files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "menu_items_menu_idx" ON "menu_items" USING btree ("menu_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "menus_handle_idx" ON "menus" USING btree ("handle");--> statement-breakpoint
CREATE UNIQUE INDEX "metafield_definitions_key_idx" ON "metafield_definitions" USING btree ("owner_type","key");--> statement-breakpoint
CREATE UNIQUE INDEX "metafield_values_owner_idx" ON "metafield_values" USING btree ("definition_id","owner_id");--> statement-breakpoint
CREATE INDEX "metafield_values_owner_lookup_idx" ON "metafield_values" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_templates_key_idx" ON "notification_templates" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "pages_status_idx" ON "pages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "saved_views_resource_idx" ON "saved_views" USING btree ("resource","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_sessions_token_idx" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_sessions_user_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_last_actor_id_users_id_fk" FOREIGN KEY ("last_actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_variant_idx" ON "order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_city_idx" ON "orders" USING btree ("city");--> statement-breakpoint
CREATE INDEX "orders_total_idx" ON "orders" USING btree ("total_paisa");--> statement-breakpoint
CREATE INDEX "orders_last_actor_idx" ON "orders" USING btree ("last_actor_id");--> statement-breakpoint
CREATE INDEX "orders_deleted_idx" ON "orders" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "product_variants_stock_idx" ON "product_variants" USING btree ("stock");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_type_idx" ON "products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "products_vendor_idx" ON "products" USING btree ("vendor");--> statement-breakpoint
CREATE INDEX "products_name_idx" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "products_deleted_idx" ON "products" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
-- Derive the new product status from the legacy is_archived flag.
UPDATE "products" SET "status" = 'archived' WHERE "is_archived" = true;--> statement-breakpoint
-- Denormalise the order line count so list views never join order_items.
UPDATE "orders" o SET "item_count" = COALESCE((SELECT SUM(i."quantity") FROM "order_items" i WHERE i."order_id" = o."id"), 0);--> statement-breakpoint
-- Existing status rows are all real status changes.
UPDATE "order_events" SET "type" = 'status' WHERE "to_status" IS NOT NULL;
