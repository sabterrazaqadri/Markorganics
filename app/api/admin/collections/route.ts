import { NextResponse } from "next/server";
import { requirePermission, AdminForbiddenError, AdminUnauthorizedError } from "@/lib/admin/session";
import { getCollectionProductIds, listCollections } from "@/lib/admin/collections";
import { parseRules } from "@/lib/admin/rules";

/**
 * Collections as JSON.
 *
 * Storefront routes for collections come later; until then this is the seam
 * they will read through, and it is what external tooling can use today.
 * Pass `?products=1` to include the ordered product ids of each collection.
 */
export async function GET(req: Request) {
  try {
    await requirePermission("collections:read");
  } catch (err) {
    const status = err instanceof AdminForbiddenError ? 403 : err instanceof AdminUnauthorizedError ? 401 : 500;
    return NextResponse.json({ error: "Not allowed" }, { status });
  }

  const withProducts = new URL(req.url).searchParams.get("products") === "1";
  const rows = await listCollections();

  const collections = await Promise.all(
    rows.map(async (c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description,
      type: c.type,
      rulesMatch: c.rulesMatch,
      rules: parseRules(c.rules),
      image: c.image,
      isPublished: c.isPublished,
      sortOrder: c.sortOrder,
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
      productCount: c.productCount,
      updatedAt: c.updatedAt,
      ...(withProducts ? { productIds: await getCollectionProductIds(c.id) } : {}),
    })),
  );

  return NextResponse.json({ collections }, { headers: { "Cache-Control": "no-store" } });
}
