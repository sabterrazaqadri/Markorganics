import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, type Db } from "@/lib/db";
import { bundleComponents, productVariants, products, type ProductWithVariants } from "@/lib/db/schema";

type Tx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Bundles.
 *
 * A bundle is an ordinary product flagged `isBundle`. Each of its variants
 * owns rows in bundle_components naming the real variants that ship. Three
 * rules keep the rest of the system unaware of bundles:
 *
 *  1. Stock is derived: a bundle variant can be sold as many times as its
 *     scarcest component allows. `syncBundleStock` mirrors that number onto
 *     the bundle variant's own stock column whenever a component moves, so
 *     the admin inventory list and the product cards read it like any other.
 *  2. Checkout expands: the cart holds the bundle variant, but the order
 *     transaction turns it into one order line per component, with the bundle
 *     price spread across them. Stock, restocks, packing slips, feeds and the
 *     inventory ledger then only ever see real variants.
 *  3. The receipt regroups: every expanded line carries bundle_sku and
 *     bundle_name so the order page can show "Winter Pain Kit" again.
 */

export interface ComponentLine {
  componentVariantId: string;
  quantity: number;
  sku: string;
  label: string;
  pricePaisa: number;
  stock: number;
  productId: string;
  productName: string;
  productSlug: string;
  image: string;
  status: string;
}

/** Component rows for a set of bundle variants, keyed on the bundle variant id. */
export async function getBundleComponents(tx: Tx, bundleVariantIds: string[]): Promise<Map<string, ComponentLine[]>> {
  const out = new Map<string, ComponentLine[]>();
  if (bundleVariantIds.length === 0) return out;
  const rows = await tx
    .select({
      bundleVariantId: bundleComponents.bundleVariantId,
      componentVariantId: bundleComponents.componentVariantId,
      quantity: bundleComponents.quantity,
      sortOrder: bundleComponents.sortOrder,
      sku: productVariants.sku,
      label: productVariants.label,
      pricePaisa: productVariants.pricePaisa,
      stock: productVariants.stock,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      images: products.images,
      status: products.status,
    })
    .from(bundleComponents)
    .innerJoin(productVariants, eq(productVariants.id, bundleComponents.componentVariantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(bundleComponents.bundleVariantId, bundleVariantIds))
    .orderBy(bundleComponents.sortOrder);
  for (const r of rows) {
    const list = out.get(r.bundleVariantId) ?? [];
    list.push({
      componentVariantId: r.componentVariantId,
      quantity: r.quantity,
      sku: r.sku,
      label: r.label,
      pricePaisa: r.pricePaisa,
      stock: r.stock,
      productId: r.productId,
      productName: r.productName,
      productSlug: r.productSlug,
      image: r.images[0] ?? "",
      status: r.status,
    });
    out.set(r.bundleVariantId, list);
  }
  return out;
}

/** How many bundles the components can cover. An empty bundle sells nothing. */
export function effectiveBundleStock(components: ComponentLine[]): number {
  if (components.length === 0) return 0;
  return Math.min(...components.map((c) => (c.status === "active" ? Math.floor(c.stock / Math.max(1, c.quantity)) : 0)));
}

/** Sum of the components bought separately, for the "you save" line. */
export function componentsListPrice(components: ComponentLine[]): number {
  return components.reduce((n, c) => n + c.pricePaisa * c.quantity, 0);
}

/**
 * Overwrites the stock column of every bundle variant that contains any of
 * the given component variants. Called after each ledger movement so the
 * mirrored number never lags. Bundle stock never goes through the ledger.
 */
export async function syncBundleStock(tx: Tx, componentVariantIds: string[]): Promise<void> {
  if (componentVariantIds.length === 0) return;
  const owners = await tx
    .selectDistinct({ bundleVariantId: bundleComponents.bundleVariantId })
    .from(bundleComponents)
    .where(inArray(bundleComponents.componentVariantId, componentVariantIds));
  const bundleIds = owners.map((o) => o.bundleVariantId);
  if (bundleIds.length === 0) return;
  const comps = await getBundleComponents(tx, bundleIds);
  for (const id of bundleIds) {
    await tx
      .update(productVariants)
      .set({ stock: effectiveBundleStock(comps.get(id) ?? []), updatedAt: new Date() })
      .where(eq(productVariants.id, id));
  }
}

/** Recomputes the stock of one bundle variant from its current components. */
export async function syncOneBundle(tx: Tx, bundleVariantId: string): Promise<number> {
  const comps = await getBundleComponents(tx, [bundleVariantId]);
  const stock = effectiveBundleStock(comps.get(bundleVariantId) ?? []);
  await tx.update(productVariants).set({ stock, updatedAt: new Date() }).where(eq(productVariants.id, bundleVariantId));
  return stock;
}

/**
 * Storefront reads: replace the stored stock of every bundle variant with the
 * live derived value. The mirror is normally exact, but the storefront page
 * is cached for a minute and a component may have sold in between.
 */
export async function withLiveBundleStock<T extends ProductWithVariants>(list: T[]): Promise<T[]> {
  const bundleVariantIds = list.filter((p) => p.isBundle).flatMap((p) => p.variants.map((v) => v.id));
  if (bundleVariantIds.length === 0) return list;
  const comps = await getBundleComponents(db, bundleVariantIds);
  return list.map((p) =>
    p.isBundle
      ? { ...p, variants: p.variants.map((v) => ({ ...v, stock: effectiveBundleStock(comps.get(v.id) ?? []) })) }
      : p,
  );
}

/**
 * Splits a bundle price across its component lines, in proportion to their
 * list prices, so the lines sum to the bundle price exactly (largest-remainder
 * rounding on the last line).
 */
export function allocateBundlePrice(bundlePricePaisa: number, components: ComponentLine[]): number[] {
  const list = componentsListPrice(components);
  if (list <= 0 || components.length === 0) return components.map(() => 0);
  // Per-unit share, floored so the lines never exceed the bundle price.
  const units = components.map((c) => Math.floor((bundlePricePaisa * c.pricePaisa) / list));
  let remainder = bundlePricePaisa - units.reduce((n, u, i) => n + u * components[i].quantity, 0);
  // The leftover paisa lands on a single-quantity line, where any integer fits.
  const single = components.findIndex((c) => c.quantity === 1);
  if (single >= 0) {
    units[single] += remainder;
    return units;
  }
  // Every line has quantity > 1: spread whole units, and accept up to
  // (quantity - 1) paisa of drift, which whole-rupee prices never produce.
  for (let i = 0; remainder > 0 && i < units.length; i++) {
    const q = components[i].quantity;
    const give = Math.floor(remainder / q);
    units[i] += give;
    remainder -= give * q;
  }
  return units;
}

/** Cart lines with bundles replaced by their components. */
export interface ExpandedLine {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  sku: string;
  unitPricePaisa: number;
  quantity: number;
  bundleSku: string | null;
  bundleName: string | null;
}
