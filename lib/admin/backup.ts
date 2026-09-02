import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Tables included in the JSON backup. Sessions and login attempts are left out
 * on purpose: they are short-lived and exporting them only spreads secrets.
 */
const TABLES = [
  "users",
  "products",
  "product_variants",
  "inventory_adjustments",
  "collections",
  "collection_products",
  "metafield_definitions",
  "metafield_values",
  "customers",
  "customer_segments",
  "orders",
  "order_items",
  "order_events",
  "draft_orders",
  "draft_order_items",
  "abandoned_checkouts",
  "discounts",
  "discount_targets",
  "discount_redemptions",
  "pages",
  "blog_posts",
  "menus",
  "menu_items",
  "media_files",
  "settings",
  "notification_templates",
  "saved_views",
  "audit_logs",
] as const;

/** Password hashes are never exported, even to the owner's own backup. */
const REDACT: Partial<Record<string, string[]>> = { users: ["password_hash"] };

export interface Backup {
  generatedAt: string;
  version: 1;
  tables: Record<string, unknown[]>;
  counts: Record<string, number>;
}

export async function buildBackup(): Promise<Backup> {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const table of TABLES) {
    // Table names come from the constant above, never from user input.
    const res = await db.execute<Record<string, unknown>>(
      sql.raw(`SELECT * FROM "${table}" ORDER BY 1 LIMIT 100000`),
    );
    const rows = (res.rows ?? []) as Record<string, unknown>[];
    const redact = REDACT[table];
    tables[table] = redact
      ? rows.map((row) => {
          const copy = { ...row };
          for (const key of redact) delete copy[key];
          return copy;
        })
      : rows;
    counts[table] = rows.length;
  }

  return { generatedAt: new Date().toISOString(), version: 1, tables, counts };
}
