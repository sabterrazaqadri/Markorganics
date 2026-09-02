import "server-only";
import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { mediaFiles, type MediaFile } from "@/lib/db/schema";

export const MEDIA_PAGE_SIZE = 60;

export interface MediaUsage {
  kind: "product" | "collection" | "blog";
  id: string;
  label: string;
}

export async function listMedia(
  filter: { q?: string; cursor?: string } = {},
): Promise<{ rows: MediaFile[]; nextCursor: string | null }> {
  const conds: SQL[] = [isNull(mediaFiles.deletedAt)];
  if (filter.q) {
    const q = `%${filter.q.trim()}%`;
    conds.push(or(ilike(mediaFiles.filename, q), ilike(mediaFiles.alt, q), ilike(mediaFiles.url, q))!);
  }
  if (filter.cursor) {
    const ms = Number(filter.cursor);
    if (Number.isFinite(ms)) conds.push(sql`${mediaFiles.createdAt} < ${new Date(ms)}`);
  }

  const rows = await db
    .select()
    .from(mediaFiles)
    .where(and(...conds))
    .orderBy(desc(mediaFiles.createdAt))
    .limit(MEDIA_PAGE_SIZE + 1);

  const hasMore = rows.length > MEDIA_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, MEDIA_PAGE_SIZE) : rows;
  const last = page[page.length - 1];
  return { rows: page, nextCursor: hasMore && last ? String(last.createdAt.getTime()) : null };
}

export async function getMedia(id: string): Promise<MediaFile | undefined> {
  return db.query.mediaFiles.findFirst({ where: eq(mediaFiles.id, id) });
}

/**
 * Everywhere a file is referenced. Shown before deleting, because an image
 * that vanishes from a live product page is the kind of mistake nobody
 * notices until a customer does.
 */
export async function findUsage(url: string): Promise<MediaUsage[]> {
  const [productRows, collectionRows, blogRows] = await Promise.all([
    db.execute<{ id: string; name: string }>(sql`
      SELECT id::text AS id, name FROM products WHERE ${url} = ANY(images) AND deleted_at IS NULL LIMIT 50
    `),
    db.execute<{ id: string; title: string }>(sql`
      SELECT id::text AS id, title FROM collections WHERE image = ${url} AND deleted_at IS NULL LIMIT 50
    `),
    db.execute<{ id: string; title: string }>(sql`
      SELECT id::text AS id, title FROM blog_posts WHERE cover_image = ${url} AND deleted_at IS NULL LIMIT 50
    `),
  ]);

  return [
    ...(productRows.rows ?? []).map((r) => ({ kind: "product" as const, id: r.id, label: r.name })),
    ...(collectionRows.rows ?? []).map((r) => ({ kind: "collection" as const, id: r.id, label: r.title })),
    ...(blogRows.rows ?? []).map((r) => ({ kind: "blog" as const, id: r.id, label: r.title })),
  ];
}

export interface RegisterMediaInput {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  alt?: string;
  uploadedById?: string | null;
}

export async function registerMedia(input: RegisterMediaInput): Promise<MediaFile> {
  const [row] = await db
    .insert(mediaFiles)
    .values({
      url: input.url,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: input.width ?? null,
      height: input.height ?? null,
      alt: input.alt ?? "",
      uploadedById: input.uploadedById ?? null,
    })
    .onConflictDoUpdate({
      target: mediaFiles.url,
      set: { deletedAt: null, updatedAt: new Date() },
    })
    .returning();
  return row;
}

/** Media is the one thing that is really deleted — the bytes have to go. */
export async function deleteMedia(id: string): Promise<MediaFile | undefined> {
  const [row] = await db.delete(mediaFiles).where(eq(mediaFiles.id, id)).returning();
  return row;
}

export async function setAlt(id: string, alt: string): Promise<void> {
  await db.update(mediaFiles).set({ alt, updatedAt: new Date() }).where(eq(mediaFiles.id, id));
}

/**
 * Adds every image already referenced by a product but missing from the
 * library, so the media list is complete on first open.
 */
export async function indexExistingProductImages(): Promise<number> {
  const res = await db.execute<{ url: string }>(sql`
    SELECT DISTINCT unnest(images) AS url FROM products WHERE deleted_at IS NULL
  `);
  const urls = (res.rows ?? []).map((r) => r.url).filter(Boolean);
  if (urls.length === 0) return 0;

  const existing = await db
    .select({ url: mediaFiles.url })
    .from(mediaFiles)
    .where(inArray(mediaFiles.url, urls));
  const have = new Set(existing.map((r) => r.url));
  const missing = urls.filter((u) => !have.has(u));
  if (missing.length === 0) return 0;

  await db
    .insert(mediaFiles)
    .values(
      missing.map((url) => ({
        url,
        filename: url.split("/").pop() ?? url,
        mimeType: url.endsWith(".png") ? "image/png" : url.endsWith(".jpg") || url.endsWith(".jpeg") ? "image/jpeg" : "image/webp",
        sizeBytes: 0,
      })),
    )
    .onConflictDoNothing();
  return missing.length;
}
