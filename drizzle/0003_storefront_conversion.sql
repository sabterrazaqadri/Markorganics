CREATE TYPE "public"."review_source" AS ENUM('storefront', 'admin');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "bundle_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_variant_id" uuid NOT NULL,
	"component_variant_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"order_id" uuid,
	"customer_name" text NOT NULL,
	"phone" text,
	"city" text DEFAULT '' NOT NULL,
	"rating" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"lang" text DEFAULT 'en' NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"source" "review_source" DEFAULT 'storefront' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"reply" text DEFAULT '' NOT NULL,
	"replied_at" timestamp with time zone,
	"ip" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "lang" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "translation_slug" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "bundle_sku" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "bundle_name" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "faqs" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "i18n" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_bundle" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_bundle_variant_id_product_variants_id_fk" FOREIGN KEY ("bundle_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_component_variant_id_product_variants_id_fk" FOREIGN KEY ("component_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bundle_components_pair_idx" ON "bundle_components" USING btree ("bundle_variant_id","component_variant_id");--> statement-breakpoint
CREATE INDEX "bundle_components_component_idx" ON "bundle_components" USING btree ("component_variant_id");--> statement-breakpoint
CREATE INDEX "reviews_product_status_idx" ON "reviews" USING btree ("product_id","status","created_at");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reviews_phone_idx" ON "reviews" USING btree ("phone");