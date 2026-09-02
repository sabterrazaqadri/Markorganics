import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, type Db } from "@/lib/db";
import { collectionProducts, collections, products, type Collection } from "@/lib/db/schema";
import { compileRules, parseRules, type RuleMatch } from "./rules";

type Tx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function listCollections(): Promise<(Collection & { productCount: number })[]> {
  const rows = await db
    .select({
      collection: collections,
      productCount: sql<number>`(
        SELECT COUNT(*)::int FROM collection_products cp WHERE cp.collection_id = ${collections.id}
      )`,
    })
    .from(collections)
    .where(isNull(collections.deletedAt))
    .orderBy(asc(collections.sortOrder), asc(collections.title));

  return rows.map((r) => ({ ...r.collection, productCount: r.productCount }));
}

export async function getCollection(id: string): Promise<Collection | undefined> {
  return db.query.collections.findFirst({ where: and(eq(collections.id, id), isNull(collections.deletedAt)) });
}

export async function getCollectionBySlug(slug: string): Promise<Collection | undefined> {
  return db.query.collections.findFirst({
    where: and(eq(collections.slug, slug), isNull(collections.deletedAt)),
  });
}

/**
 * Runs an automatic collection's rules and returns the product ids that match.
 * Manual collections are answered from collection_products directly.
 */
export async function resolveAutomaticMembers(collection: Collection, tx: Tx = db): Promise<string[]> {
  const where = compileRules(parseRules(collection.rules), collection.rulesMatch as RuleMatch, "product");
  if (!where) return [];
  const result = await tx.execute<{ id: string }>(sql`
    SELECT p.id::text AS id FROM products p
    WHERE p.deleted_at IS NULL AND p.status <> 'archived' AND (${where})
    ORDER BY p.sort_order ASC, p.name ASC
    LIMIT 500
  `);
  return (result.rows ?? []).map((r) => r.id);
}

/** Rewrites collection_products for an automatic collection. */
export async function reevaluateCollection(collection: Collection, tx: Tx = db): Promise<number> {
  if (collection.type !== "automatic") return 0;
  const ids = await resolveAutomaticMembers(collection, tx);
  await tx.delete(collectionProducts).where(eq(collectionProducts.collectionId, collection.id));
  if (ids.length) {
    await tx.insert(collectionProducts).values(
      ids.map((productId, i) => ({ collectionId: collection.id, productId, position: i })),
    );
  }
  return ids.length;
}

/** Called after every product save so automatic collections stay honest. */
export async function reevaluateAllAutomaticCollections(tx: Tx = db): Promise<number> {
  const autos = await tx
    .select()
    .from(collections)
    .where(and(eq(collections.type, "automatic"), isNull(collections.deletedAt)));
  let total = 0;
  for (const collection of autos) total += await reevaluateCollection(collection, tx);
  return total;
}

export async function getCollectionProductIds(collectionId: string, tx: Tx = db): Promise<string[]> {
  const rows = await tx
    .select({ productId: collectionProducts.productId })
    .from(collectionProducts)
    .where(eq(collectionProducts.collectionId, collectionId))
    .orderBy(asc(collectionProducts.position));
  return rows.map((r) => r.productId);
}

export async function getCollectionMembers(collectionId: string) {
  return db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      status: products.status,
      family: products.family,
      images: products.images,
      position: collectionProducts.position,
    })
    .from(collectionProducts)
    .innerJoin(products, eq(products.id, collectionProducts.productId))
    .where(and(eq(collectionProducts.collectionId, collectionId), isNull(products.deletedAt)))
    .orderBy(asc(collectionProducts.position));
}

export async function setManualMembers(collectionId: string, productIds: string[], tx: Tx = db): Promise<void> {
  await tx.delete(collectionProducts).where(eq(collectionProducts.collectionId, collectionId));
  if (productIds.length) {
    await tx.insert(collectionProducts).values(
      productIds.map((productId, i) => ({ collectionId, productId, position: i })),
    );
  }
}

/** Which collections a product belongs to, for the product editor sidebar. */
export async function getCollectionsForProduct(productId: string) {
  return db
    .select({ id: collections.id, title: collections.title, type: collections.type })
    .from(collectionProducts)
    .innerJoin(collections, eq(collections.id, collectionProducts.collectionId))
    .where(and(eq(collectionProducts.productId, productId), isNull(collections.deletedAt)))
    .orderBy(asc(collections.title));
}
