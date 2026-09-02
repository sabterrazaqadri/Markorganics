import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { normalizePkPhone } from "@/lib/phone";

export interface SearchHit {
  kind: "order" | "product" | "customer";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Global search behind Cmd/Ctrl+K. Orders by number or phone, products by name
 * or SKU, customers by name or phone. Everything is one indexed query per type.
 */
export async function globalSearch(rawQuery: string, limit = 6): Promise<SearchHit[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];

  const like = `%${q}%`;
  // A typed 03xx number should also match the stored +92 form.
  const asPhone = normalizePkPhone(q);
  const phoneLike = asPhone ? `%${asPhone}%` : like;

  const [orders, products, customers] = await Promise.all([
    db.execute<{ id: string; order_number: string; customer_name: string; phone: string; status: string; total_paisa: number }>(sql`
      SELECT id::text AS id, order_number, customer_name, phone, status::text AS status, total_paisa
      FROM orders
      WHERE deleted_at IS NULL AND (order_number ILIKE ${like} OR phone ILIKE ${phoneLike} OR customer_name ILIKE ${like})
      ORDER BY created_at DESC LIMIT ${limit}
    `),
    db.execute<{ id: string; name: string; slug: string; sku: string | null }>(sql`
      SELECT p.id::text AS id, p.name, p.slug,
             (SELECT pv.sku FROM product_variants pv WHERE pv.product_id = p.id AND pv.sku ILIKE ${like} LIMIT 1) AS sku
      FROM products p
      WHERE p.deleted_at IS NULL AND (
        p.name ILIKE ${like} OR p.slug ILIKE ${like}
        OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.sku ILIKE ${like})
      )
      ORDER BY p.name LIMIT ${limit}
    `),
    db.execute<{ id: string; name: string; phone: string; orders_count: number }>(sql`
      SELECT id::text AS id, name, phone, orders_count
      FROM customers
      WHERE deleted_at IS NULL AND merged_into_id IS NULL AND (name ILIKE ${like} OR phone ILIKE ${phoneLike})
      ORDER BY last_order_at DESC NULLS LAST LIMIT ${limit}
    `),
  ]);

  const hits: SearchHit[] = [];
  for (const o of orders.rows ?? []) {
    hits.push({
      kind: "order",
      id: o.id,
      title: o.order_number,
      subtitle: `${o.customer_name} · ${o.status}`,
      href: `/admin/orders/${o.id}`,
    });
  }
  for (const p of products.rows ?? []) {
    hits.push({
      kind: "product",
      id: p.id,
      title: p.name,
      subtitle: p.sku ? `SKU ${p.sku}` : `/${p.slug}`,
      href: `/admin/products/${p.id}`,
    });
  }
  for (const c of customers.rows ?? []) {
    hits.push({
      kind: "customer",
      id: c.id,
      title: c.name || c.phone,
      subtitle: `${c.phone} · ${c.orders_count} order${c.orders_count === 1 ? "" : "s"}`,
      href: `/admin/customers/${c.id}`,
    });
  }
  return hits;
}
