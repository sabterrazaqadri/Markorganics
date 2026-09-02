import "./env";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, productVariants } from "@/lib/db/schema";
import { SEED_PRODUCTS } from "@/lib/db/seed-data";
import { rupeesToPaisa } from "@/lib/money";

/**
 * Idempotent seed: upserts each product by slug and each variant by SKU.
 * Existing stock levels and prices are preserved unless --reset is passed.
 */
async function main() {
  const reset = process.argv.includes("--reset");
  let created = 0;
  let updated = 0;

  for (const p of SEED_PRODUCTS) {
    const existing = await db.query.products.findFirst({ where: eq(products.slug, p.slug) });
    const base = {
      name: p.name,
      family: p.family,
      shortDescription: p.shortDescription,
      longDescription: p.longDescription,
      howToUse: p.howToUse,
      ingredients: p.ingredients,
      benefits: p.benefits,
      images: p.images,
      isBestseller: p.isBestseller,
      sortOrder: p.sortOrder,
      updatedAt: new Date(),
    };

    let productId: string;
    if (existing) {
      await db.update(products).set(base).where(eq(products.id, existing.id));
      productId = existing.id;
      updated++;
    } else {
      const [row] = await db
        .insert(products)
        .values({ ...base, slug: p.slug })
        .returning({ id: products.id });
      productId = row.id;
      created++;
    }

    for (const [i, v] of p.variants.entries()) {
      const existingVariant = await db.query.productVariants.findFirst({ where: eq(productVariants.sku, v.sku) });
      const values = {
        productId,
        sku: v.sku,
        label: v.label,
        pricePaisa: rupeesToPaisa(v.priceRupees),
        compareAtPaisa: v.compareAtRupees ? rupeesToPaisa(v.compareAtRupees) : null,
        stock: v.stock,
        sortOrder: i,
        updatedAt: new Date(),
      };
      if (existingVariant) {
        const { stock, pricePaisa, compareAtPaisa, ...rest } = values;
        await db
          .update(productVariants)
          .set(reset ? values : rest)
          .where(eq(productVariants.id, existingVariant.id));
        void stock;
        void pricePaisa;
        void compareAtPaisa;
      } else {
        await db.insert(productVariants).values(values);
      }
    }
  }

  console.log(`Seed complete. Products created: ${created}, updated: ${updated}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
