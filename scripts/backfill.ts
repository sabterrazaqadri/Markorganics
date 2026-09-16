/**
 * Derives everything the new admin modules need from data that already exists.
 *
 * Safe to run more than once: every step is idempotent, and nothing existing is
 * overwritten. Run it after `npm run db:migrate`.
 *
 *   npm run db:backfill
 */
import "./env";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts, menuItems, menus, notificationTemplates, pages, settings } from "@/lib/db/schema";
import { normalizePkPhone } from "@/lib/phone";
import { indexExistingProductImages } from "@/lib/admin/media";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { SEED_PAGES, SEED_TEMPLATES } from "./backfill-content";

function step(name: string) {
  process.stdout.write(`  ${name}… `);
}
function done(detail: string) {
  console.log(detail);
}

/* --------------------------------------------------------------- customers */

/**
 * One customer per normalised phone number, with every order attached and the
 * aggregates recomputed. Orders that share a number merge into one record.
 */
async function backfillCustomers() {
  step("Customers from existing orders");

  // Normalise any phone that predates the +92 convention.
  const orderRows = await db.execute<{ id: string; phone: string }>(sql`
    SELECT id::text AS id, phone FROM orders WHERE phone NOT LIKE '+92%'
  `);
  for (const row of orderRows.rows ?? []) {
    const normalized = normalizePkPhone(row.phone);
    if (normalized && normalized !== row.phone) {
      await db.execute(sql`UPDATE orders SET phone = ${normalized} WHERE id = ${row.id}::uuid`);
    }
  }

  // Create a customer per distinct phone, keeping the most recent name and city.
  await db.execute(sql`
    INSERT INTO customers (phone, name, city)
    SELECT DISTINCT ON (o.phone)
      o.phone,
      o.customer_name,
      o.city
    FROM orders o
    WHERE o.phone LIKE '+92%'
    ORDER BY o.phone, o.created_at DESC
    ON CONFLICT (phone) DO NOTHING
  `);

  await db.execute(sql`
    UPDATE orders o SET customer_id = c.id
    FROM customers c
    WHERE o.customer_id IS NULL AND c.phone = o.phone
  `);

  // Recompute every aggregate in one statement rather than row by row.
  await db.execute(sql`
    UPDATE customers c SET
      orders_count      = COALESCE(s.orders_count, 0),
      delivered_count   = COALESCE(s.delivered_count, 0),
      cancelled_count   = COALESCE(s.cancelled_count, 0),
      returned_count    = COALESCE(s.returned_count, 0),
      total_spent_paisa = COALESCE(s.total_spent, 0),
      avg_order_paisa   = CASE WHEN COALESCE(s.paid_orders, 0) = 0 THEN 0 ELSE (s.total_spent / s.paid_orders)::int END,
      first_order_at    = s.first_order_at,
      last_order_at     = s.last_order_at,
      updated_at        = now()
    FROM (
      SELECT
        o.customer_id,
        COUNT(*)::int AS orders_count,
        COUNT(*) FILTER (WHERE o.status = 'delivered')::int AS delivered_count,
        COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_count,
        COUNT(*) FILTER (WHERE o.status = 'returned')::int  AS returned_count,
        COALESCE(SUM(o.total_paisa) FILTER (WHERE o.status IN ('pending','confirmed','shipped','delivered')), 0)::int AS total_spent,
        COUNT(*) FILTER (WHERE o.status IN ('pending','confirmed','shipped','delivered'))::int AS paid_orders,
        MIN(o.created_at) AS first_order_at,
        MAX(o.created_at) AS last_order_at
      FROM orders o
      WHERE o.customer_id IS NOT NULL AND o.deleted_at IS NULL
      GROUP BY o.customer_id
    ) s
    WHERE c.id = s.customer_id
  `);

  const [{ n }] = (
    await db.execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM customers`)
  ).rows;
  const [{ orphans }] = (
    await db.execute<{ orphans: number }>(sql`SELECT COUNT(*)::int AS orphans FROM orders WHERE customer_id IS NULL`)
  ).rows;
  done(`${n} customers, ${orphans} orders still unattached`);
}

/* ----------------------------------------------------------------- orders */

async function backfillOrderCounts() {
  step("Order item counts and timeline types");
  await db.execute(sql`
    UPDATE orders o SET item_count = COALESCE(s.n, 0)
    FROM (SELECT order_id, SUM(quantity)::int AS n FROM order_items GROUP BY order_id) s
    WHERE o.id = s.order_id AND o.item_count = 0
  `);
  await db.execute(sql`UPDATE order_events SET type = 'status' WHERE to_status IS NOT NULL AND type IS NULL`);
  done("done");
}

/* --------------------------------------------------------------- products */

async function backfillProducts() {
  step("Product status and inventory baseline");

  await db.execute(sql`UPDATE products SET status = 'archived' WHERE is_archived = true AND status <> 'archived'`);
  await db.execute(sql`UPDATE products SET is_archived = (status = 'archived')`);

  // An opening balance so the ledger explains today's number.
  await db.execute(sql`
    INSERT INTO inventory_adjustments (variant_id, delta, resulting_stock, reason, note)
    SELECT pv.id, pv.stock, pv.stock, 'recount', 'Opening balance recorded during backfill'
    FROM product_variants pv
    WHERE NOT EXISTS (SELECT 1 FROM inventory_adjustments ia WHERE ia.variant_id = pv.id)
  `);

  const [{ n }] = (
    await db.execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM inventory_adjustments`)
  ).rows;
  done(`${n} ledger rows`);
}

/* ---------------------------------------------------------------- content */

async function backfillContent() {
  step("Pages and policies");
  let created = 0;
  for (const page of SEED_PAGES) {
    const existing = await db.query.pages.findFirst({ where: eq(pages.slug, page.slug), columns: { id: true } });
    if (existing) continue;
    await db.insert(pages).values({
      slug: page.slug,
      title: page.title,
      body: page.body,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      status: "published",
      isSystem: page.isSystem,
      publishedAt: new Date(),
    });
    created += 1;
  }
  done(`${created} created, ${SEED_PAGES.length - created} already existed`);

  step("Notification templates");
  let templates = 0;
  for (const template of SEED_TEMPLATES) {
    const [row] = await db
      .insert(notificationTemplates)
      .values(template)
      .onConflictDoNothing({ target: notificationTemplates.key })
      .returning({ id: notificationTemplates.id });
    if (row) templates += 1;
  }
  done(`${templates} created`);

  step("Menus");
  for (const handle of ["header", "footer"] as const) {
    await db
      .insert(menus)
      .values({ handle, title: handle === "header" ? "Header" : "Footer" })
      .onConflictDoNothing({ target: menus.handle });
  }
  // Only seed items when a menu is completely empty, so edits are never lost.
  const headerMenu = await db.query.menus.findFirst({ where: eq(menus.handle, "header") });
  if (headerMenu) {
    const existing = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.menuId, headerMenu.id)).limit(1);
    if (existing.length === 0) {
      await db.insert(menuItems).values([
        { menuId: headerMenu.id, label: "Oils", url: "/collections/oils", resourceType: "collection", position: 0 },
        { menuId: headerMenu.id, label: "Relief", url: "/collections/relief", resourceType: "collection", position: 1 },
        { menuId: headerMenu.id, label: "Home", url: "/collections/home", resourceType: "collection", position: 2 },
        { menuId: headerMenu.id, label: "All products", url: "/products", resourceType: "custom", position: 3 },
        { menuId: headerMenu.id, label: "Journal", url: "/blog", resourceType: "custom", position: 4 },
        { menuId: headerMenu.id, label: "Track order", url: "/track", resourceType: "custom", position: 5 },
      ]);
    }
  }
  const footerMenu = await db.query.menus.findFirst({ where: eq(menus.handle, "footer") });
  if (footerMenu) {
    const existing = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.menuId, footerMenu.id)).limit(1);
    if (existing.length === 0) {
      await db.insert(menuItems).values([
        { menuId: footerMenu.id, label: "Track an order", url: "/track", resourceType: "custom", position: 0 },
        { menuId: footerMenu.id, label: "Shipping and returns", url: "/shipping-returns", resourceType: "page", position: 1 },
        { menuId: footerMenu.id, label: "FAQ", url: "/faq", resourceType: "custom", position: 2 },
        { menuId: footerMenu.id, label: "Contact", url: "/contact", resourceType: "custom", position: 3 },
      ]);
    }
  }
  done("header and footer ready");

  step("Blog");
  const [{ n: postCount }] = (
    await db.execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM blog_posts`)
  ).rows;
  if (postCount === 0) {
    await db.insert(blogPosts).values({
      slug: "how-to-use-mustard-oil-for-hair-fall",
      title: "How to use mustard oil for hair fall",
      excerpt:
        "A weekly routine that actually gets used: warm the oil, work it into the scalp, leave it long enough to matter.",
      body: [
        "Most people give up on hair oil because the routine is too fussy to keep. This one is three steps and takes ten minutes.",
        "",
        "## Warm it first",
        "Cold-pressed mustard oil is thick. Stand the bottle in a mug of hot water for two minutes; do not put it on a flame. Warm oil spreads further and needs less of it.",
        "",
        "## Work the scalp, not the hair",
        "- Part the hair in sections and put the oil on the scalp",
        "- Use the pads of your fingers, not your nails",
        "- Five minutes of slow circles is enough",
        "",
        "## Leave it on",
        "An hour is the minimum. Overnight is better if you can sleep on an old pillowcase. Wash it out with a mild shampoo; one lather is usually enough if you did not overdo the quantity.",
        "",
        "Twice a week is plenty. If your scalp is irritated, patch-test on the forearm first and stop if it stings.",
      ].join("\n"),
      authorName: "MARKORGANIC",
      tags: ["hair", "how to"],
      status: "published",
      publishedAt: new Date(),
      seoDescription: "A simple weekly mustard oil routine for hair fall and dry scalp, from MARKORGANIC.",
    });
    done("one starter post created");
  } else {
    done(`${postCount} posts already exist`);
  }
}

/* --------------------------------------------------------------- settings */

async function backfillSettings() {
  step("Settings from config/commerce.ts");
  let written = 0;
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const [row] = await db
      .insert(settings)
      .values({ key, value: value as never })
      .onConflictDoNothing({ target: settings.key })
      .returning({ key: settings.key });
    if (row) written += 1;
  }
  done(`${written} written, ${Object.keys(DEFAULT_SETTINGS).length - written} already set`);
}

/* ------------------------------------------------------------------ media */

async function backfillMedia() {
  step("Media library from product images");
  const added = await indexExistingProductImages();
  done(`${added} files indexed`);
}

/* -------------------------------------------------------------------- run */

async function main() {
  console.log("Backfilling MARKORGANIC admin data\n");
  await backfillCustomers();
  await backfillOrderCounts();
  await backfillProducts();
  await backfillSettings();
  await backfillContent();
  await backfillMedia();

  const [{ activeProducts }] = (
    await db.execute<{ activeProducts: number }>(
      sql`SELECT COUNT(*)::int AS "activeProducts" FROM products WHERE status = 'active' AND deleted_at IS NULL`,
    )
  ).rows;
  console.log(`\nDone. ${activeProducts} products are live on the storefront.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\nBackfill failed:", err);
  process.exit(1);
});
