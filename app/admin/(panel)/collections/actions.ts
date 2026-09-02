"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { collections, products } from "@/lib/db/schema";
import { requirePermission } from "@/lib/admin/session";
import { audit, diff } from "@/lib/admin/audit";
import { ActionError, run, type ActionResult } from "@/lib/admin/result";
import { revalidateCatalog } from "@/lib/admin/revalidate";
import { collectionSchema } from "@/lib/validation/admin";
import { getCollection, reevaluateCollection, setManualMembers } from "@/lib/admin/collections";
import { compileRules, parseRules, type Rule, type RuleMatch } from "@/lib/admin/rules";
import type { z } from "zod";

type CollectionInput = z.input<typeof collectionSchema>;

export async function saveCollectionAction(input: CollectionInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("collections:write");
    const values = collectionSchema.parse(input);

    const clash = await db.query.collections.findFirst({
      where: and(eq(collections.slug, values.slug), isNull(collections.deletedAt)),
      columns: { id: true },
    });
    if (clash && clash.id !== values.id) throw new ActionError(`Slug "${values.slug}" is already used.`);

    const row = {
      title: values.title,
      slug: values.slug,
      description: values.description,
      type: values.type,
      rulesMatch: values.rulesMatch,
      rules: values.rules as never,
      image: values.image,
      isPublished: values.isPublished,
      sortOrder: values.sortOrder,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
      updatedAt: new Date(),
    };

    let id = values.id;
    const before = id ? await getCollection(id) : undefined;

    if (id) {
      if (!before) throw new ActionError("Collection not found.");
      await db.update(collections).set(row).where(eq(collections.id, id));
    } else {
      const [created] = await db.insert(collections).values(row).returning({ id: collections.id });
      id = created.id;
    }

    const saved = await getCollection(id!);
    if (!saved) throw new ActionError("Collection not found after saving.");

    if (saved.type === "manual") {
      await setManualMembers(saved.id, values.productIds);
    } else {
      await reevaluateCollection(saved);
    }

    const d = diff(
      before as unknown as Record<string, unknown> | undefined,
      saved as unknown as Record<string, unknown>,
      ["title", "slug", "type", "rulesMatch", "isPublished", "sortOrder"],
    );
    await audit(ctx, {
      action: before ? "collection.update" : "collection.create",
      entityType: "collection",
      entityId: saved.id,
      entityLabel: saved.title,
      before: d.before,
      after: d.after,
    });

    revalidatePath("/admin/collections");
    revalidatePath(`/admin/collections/${saved.id}`);
    revalidateCatalog();
    return { id: saved.id };
  });
}

export async function deleteCollectionAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("collections:write");
    const before = await getCollection(id);
    if (!before) throw new ActionError("Collection not found.");
    await db.update(collections).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(collections.id, id));
    await audit(ctx, {
      action: "collection.delete",
      entityType: "collection",
      entityId: id,
      entityLabel: before.title,
      after: { deleted: true },
    });
    revalidatePath("/admin/collections");
    return null;
  });
}

export async function reevaluateAction(id: string): Promise<ActionResult<{ count: number }>> {
  return run(async () => {
    const ctx = await requirePermission("collections:write");
    const collection = await getCollection(id);
    if (!collection) throw new ActionError("Collection not found.");
    const count = await reevaluateCollection(collection);
    await audit(ctx, { action: "collection.reevaluate", entityType: "collection", entityId: id, after: { count } });
    revalidatePath(`/admin/collections/${id}`);
    return { count };
  });
}

export interface RulePreviewRow extends Record<string, unknown> {
  id: string;
  name: string;
  slug: string;
  status: string;
}

/** Live preview so nobody saves a rule set that matches nothing. */
export async function previewRulesAction(
  rules: Rule[],
  match: RuleMatch,
): Promise<ActionResult<{ rows: RulePreviewRow[]; total: number }>> {
  return run(async () => {
    await requirePermission("collections:read");
    const where = compileRules(parseRules(rules), match, "product");
    if (!where) return { rows: [], total: 0 };

    const [list, count] = await Promise.all([
      db.execute<RulePreviewRow>(sql`
        SELECT p.id::text AS id, p.name, p.slug, p.status::text AS status
        FROM products p
        WHERE p.deleted_at IS NULL AND p.status <> 'archived' AND (${where})
        ORDER BY p.name LIMIT 25
      `),
      db.execute<{ n: number }>(sql`
        SELECT COUNT(*)::int AS n FROM products p
        WHERE p.deleted_at IS NULL AND p.status <> 'archived' AND (${where})
      `),
    ]);
    return { rows: list.rows ?? [], total: count.rows?.[0]?.n ?? 0 };
  });
}

export async function listProductOptionsAction(): Promise<{ id: string; name: string; slug: string }[]> {
  await requirePermission("collections:read");
  return db
    .select({ id: products.id, name: products.name, slug: products.slug })
    .from(products)
    .where(isNull(products.deletedAt))
    .orderBy(asc(products.name))
    .limit(500);
}
