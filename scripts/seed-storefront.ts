import "./env";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { bundleComponents, products, productVariants } from "@/lib/db/schema";
import { PRODUCT_CONTENT, SEED_BUNDLES } from "@/lib/db/seed-storefront";
import { syncOneBundle } from "@/lib/bundles";
import { rupeesToPaisa } from "@/lib/money";

/**
 * Applies FAQ pairs and Urdu copy to the existing products, and creates the
 * kits. Idempotent: run it as often as you like.
 *
 *   npx tsx scripts/seed-storefront.ts            # fill only what is empty
 *   npx tsx scripts/seed-storefront.ts --reset    # overwrite FAQs and Urdu copy too
 *
 * Kit prices are written only when the kit is created; afterwards the admin
 * owns them.
 */
async function main() {
  const reset = process.argv.includes("--reset");

  /* ---------------------------------------------------- FAQs and Urdu copy */
  for (const [slug, content] of Object.entries(PRODUCT_CONTENT)) {
    const row = await db.query.products.findFirst({ where: and(eq(products.slug, slug), isNull(products.deletedAt)) });
    if (!row) {
      console.log(`  skip ${slug}: not in the catalogue`);
      continue;
    }
    const patch: Partial<typeof row> = { updatedAt: new Date() };
    if (reset || !row.faqs?.length) patch.faqs = content.faqs;
    const existingUr = row.i18n?.ur ?? {};
    const hasUrdu = Boolean(existingUr.shortDescription || existingUr.longDescription);
    if (reset || !hasUrdu) patch.i18n = { ...row.i18n, ur: { ...existingUr, ...content.ur } };
    await db.update(products).set(patch).where(eq(products.id, row.id));
    console.log(`  content ${slug}${patch.faqs ? " +faqs" : ""}${patch.i18n ? " +urdu" : ""}`);
  }

  /* --------------------------------------------------------------- kits */
  for (const kit of SEED_BUNDLES) {
    const skus = kit.components.map((c) => c.sku);
    const parts = await db
      .select({ id: productVariants.id, sku: productVariants.sku })
      .from(productVariants)
      .where(and(inArray(productVariants.sku, skus), isNull(productVariants.deletedAt)));
    if (parts.length !== skus.length) {
      console.log(`  skip kit ${kit.slug}: missing parts ${skus.filter((s) => !parts.some((p) => p.sku === s)).join(", ")}`);
      continue;
    }
    const partIds = new Map(parts.map((p) => [p.sku, p.id]));

    // A kit shows the photos of what is inside it.
    const partProducts = await db
      .select({ images: products.images })
      .from(products)
      .innerJoin(productVariants, eq(productVariants.productId, products.id))
      .where(inArray(productVariants.sku, skus));
    const images = partProducts.map((p) => p.images[0]).filter(Boolean);

    const base = {
      name: kit.name,
      family: kit.family,
      shortDescription: kit.shortDescription,
      longDescription: kit.longDescription,
      howToUse: kit.howToUse,
      ingredients: "See the products inside the kit.",
      benefits: kit.benefits,
      isBundle: true,
      sortOrder: kit.sortOrder,
      updatedAt: new Date(),
    };

    let existing = await db.query.products.findFirst({ where: eq(products.slug, kit.slug), with: { variants: true } });
    if (existing) {
      const patch: Record<string, unknown> = { ...base };
      if (reset || !existing.faqs?.length) patch.faqs = kit.faqs;
      if (reset || !existing.i18n?.ur?.shortDescription) patch.i18n = { ur: kit.ur };
      await db.update(products).set(patch).where(eq(products.id, existing.id));
      console.log(`  kit ${kit.slug}: updated`);
    } else {
      const [row] = await db
        .insert(products)
        .values({
          ...base,
          slug: kit.slug,
          status: "active",
          isBestseller: false,
          images,
          faqs: kit.faqs,
          i18n: { ur: kit.ur },
          productType: "Kit",
          tags: ["kit"],
        })
        .returning({ id: products.id });
      await db.insert(productVariants).values({
        productId: row.id,
        sku: kit.sku,
        label: kit.label,
        pricePaisa: rupeesToPaisa(kit.priceRupees),
        compareAtPaisa: null,
        stock: 0,
        lowStockThreshold: 3,
        sortOrder: 0,
      });
      existing = await db.query.products.findFirst({ where: eq(products.id, row.id), with: { variants: true } });
      console.log(`  kit ${kit.slug}: created at Rs ${kit.priceRupees}`);
    }

    for (const variant of existing!.variants) {
      await db.delete(bundleComponents).where(eq(bundleComponents.bundleVariantId, variant.id));
      await db.insert(bundleComponents).values(
        kit.components.map((c, i) => ({
          bundleVariantId: variant.id,
          componentVariantId: partIds.get(c.sku)!,
          quantity: c.quantity,
          sortOrder: i,
        })),
      );
      const stock = await syncOneBundle(db, variant.id);
      console.log(`    ${variant.sku}: ${kit.components.length} parts, ${stock} in stock`);
    }
  }

  console.log("Storefront content seeded.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
