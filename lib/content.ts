import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts, menuItems, menus, pages, type BlogPost, type Page } from "@/lib/db/schema";
import { toPlainText } from "@/lib/rich-text";

export const CONTENT_TAG = "content";
export const MENU_TAG = "menus";

/** Slugs that back a fixed storefront route and can never be deleted. */
export const SYSTEM_PAGE_SLUGS = ["about", "privacy", "shipping-returns", "terms", "refund"] as const;
export type SystemPageSlug = (typeof SYSTEM_PAGE_SLUGS)[number];

export const POLICY_SLUGS: SystemPageSlug[] = ["privacy", "shipping-returns", "terms", "refund"];

/* ----------------------------------------------------------------- pages */

async function readPage(slug: string): Promise<Page | undefined> {
  return db.query.pages.findFirst({
    where: and(eq(pages.slug, slug), eq(pages.status, "published"), isNull(pages.deletedAt)),
  });
}

/**
 * unstable_cache serialises through JSON, so a cache hit returns Date columns
 * as ISO strings while a miss returns real Dates. Every cached reader below
 * therefore revives its timestamps, and callers can rely on Date everywhere.
 */
function reviveDates<T extends Record<string, unknown>>(row: T, keys: (keyof T)[]): T {
  const out = { ...row };
  for (const key of keys) {
    const value = out[key];
    if (typeof value === "string") out[key] = new Date(value) as T[keyof T];
  }
  return out;
}

const PAGE_DATES = ["publishedAt", "deletedAt", "createdAt", "updatedAt"] as const;
const POST_DATES = ["publishedAt", "deletedAt", "createdAt", "updatedAt"] as const;

const cachedPage = unstable_cache(readPage, ["page"], { tags: [CONTENT_TAG], revalidate: 3600 });

export async function getPublishedPage(slug: string): Promise<Page | undefined> {
  const page = await cachedPage(slug);
  return page ? reviveDates(page, [...PAGE_DATES]) : undefined;
}

export async function listPagesAdmin(): Promise<Page[]> {
  return db.query.pages.findMany({ where: isNull(pages.deletedAt), orderBy: [asc(pages.title)] });
}

export async function getPageAdmin(id: string): Promise<Page | undefined> {
  return db.query.pages.findFirst({ where: eq(pages.id, id) });
}

export async function listPublishedPageSlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: pages.slug })
    .from(pages)
    .where(and(eq(pages.status, "published"), isNull(pages.deletedAt)));
  return rows.map((r) => r.slug);
}

/* ------------------------------------------------------------------ blog */

/** Published means status published AND the publish time has arrived. */
const livePost = and(
  eq(blogPosts.status, "published"),
  isNull(blogPosts.deletedAt),
  or(isNull(blogPosts.publishedAt), lte(blogPosts.publishedAt, sql`now()`))!,
);

async function readPosts(limit: number): Promise<BlogPost[]> {
  return db.query.blogPosts.findMany({
    where: livePost,
    orderBy: [desc(blogPosts.publishedAt), desc(blogPosts.createdAt)],
    limit,
  });
}

const cachedPosts = unstable_cache(readPosts, ["blog-index"], { tags: [CONTENT_TAG], revalidate: 900 });

export async function getPublishedPosts(limit: number): Promise<BlogPost[]> {
  const posts = await cachedPosts(limit);
  return posts.map((post) => reviveDates(post, [...POST_DATES]));
}

async function readPost(slug: string): Promise<BlogPost | undefined> {
  return db.query.blogPosts.findFirst({ where: and(eq(blogPosts.slug, slug), livePost) });
}

const cachedPost = unstable_cache(readPost, ["blog-post"], { tags: [CONTENT_TAG], revalidate: 900 });

export async function getPublishedPost(slug: string): Promise<BlogPost | undefined> {
  const post = await cachedPost(slug);
  return post ? reviveDates(post, [...POST_DATES]) : undefined;
}

export async function listPostsAdmin(): Promise<BlogPost[]> {
  return db.query.blogPosts.findMany({
    where: isNull(blogPosts.deletedAt),
    orderBy: [desc(blogPosts.publishedAt), desc(blogPosts.createdAt)],
    limit: 200,
  });
}

export async function getPostAdmin(id: string): Promise<BlogPost | undefined> {
  return db.query.blogPosts.findFirst({ where: eq(blogPosts.id, id) });
}

/* ----------------------------------------------------------------- menus */

export interface MenuNode {
  id: string;
  label: string;
  url: string;
  children: MenuNode[];
}

function nest(rows: { id: string; parentId: string | null; label: string; url: string; position: number }[]): MenuNode[] {
  const byId = new Map<string, MenuNode>();
  for (const r of rows) byId.set(r.id, { id: r.id, label: r.label, url: r.url, children: [] });
  const roots: MenuNode[] = [];
  for (const r of rows) {
    const node = byId.get(r.id)!;
    const parent = r.parentId ? byId.get(r.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

async function readMenu(handle: "header" | "footer"): Promise<MenuNode[]> {
  const rows = await db
    .select({
      id: menuItems.id,
      parentId: menuItems.parentId,
      label: menuItems.label,
      url: menuItems.url,
      position: menuItems.position,
    })
    .from(menuItems)
    .innerJoin(menus, eq(menus.id, menuItems.menuId))
    .where(eq(menus.handle, handle))
    .orderBy(asc(menuItems.position));
  return nest(rows);
}

/** The storefront reads menus from the database with a long cache. */
export const getMenu = unstable_cache(readMenu, ["menu"], { tags: [MENU_TAG], revalidate: 3600 });

export async function getMenuRows(handle: "header" | "footer") {
  const menu = await db.query.menus.findFirst({ where: eq(menus.handle, handle) });
  if (!menu) return { menuId: null, items: [] };
  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.menuId, menu.id))
    .orderBy(asc(menuItems.position));
  return { menuId: menu.id, items };
}

/* ------------------------------------------------------------ rendering */

export { renderRichText, toPlainText } from "@/lib/rich-text";

export function excerptOf(post: BlogPost, max = 180): string {
  if (post.excerpt) return post.excerpt;
  return toPlainText(post.body, max);
}
