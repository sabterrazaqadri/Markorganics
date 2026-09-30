-- The home family (liquid neel) is retired. Postgres cannot drop an enum value,
-- so the type is rebuilt without it. Any leftover home product moves to oils;
-- the only one was the archived MARK Liquid Neel.
UPDATE "products" SET "family" = 'oils' WHERE "family" = 'home';--> statement-breakpoint
ALTER TYPE "public"."product_family" RENAME TO "product_family_old";--> statement-breakpoint
CREATE TYPE "public"."product_family" AS ENUM('oils', 'relief', 'seeds', 'capsules', 'herbal');--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "family" SET DATA TYPE "public"."product_family" USING "family"::text::"public"."product_family";--> statement-breakpoint
DROP TYPE "public"."product_family_old";
