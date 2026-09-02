"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts, menuItems, menus, pages } from "@/lib/db/schema";
import { requirePermission } from "@/lib/admin/session";
import { audit, diff } from "@/lib/admin/audit";
import { ActionError, run, type ActionResult } from "@/lib/admin/result";
import { revalidateContent, revalidateMenus } from "@/lib/admin/revalidate";
import { blogPostSchema, menuSchema, pageSchema } from "@/lib/validation/admin";
import { SYSTEM_PAGE_SLUGS } from "@/lib/content";
import type { z } from "zod";

/* ----------------------------------------------------------------- pages */

export async function savePageAction(input: z.input<typeof pageSchema>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("content:write");
    const values = pageSchema.parse(input);

    const clash = await db.query.pages.findFirst({
      where: and(eq(pages.slug, values.slug), isNull(pages.deletedAt)),
      columns: { id: true },
    });
    if (clash && clash.id !== values.id) throw new ActionError(`The slug "${values.slug}" is already used.`);

    const before = values.id ? await db.query.pages.findFirst({ where: eq(pages.id, values.id) }) : undefined;
    if (before?.isSystem && before.slug !== values.slug) {
      throw new ActionError("This page backs a fixed storefront route, so its slug cannot change.");
    }

    const row = {
      slug: values.slug,
      title: values.title,
      body: values.body,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
      status: values.status,
      publishedAt: values.status === "published" ? (before?.publishedAt ?? new Date()) : before?.publishedAt ?? null,
      updatedAt: new Date(),
    };

    let id = values.id;
    if (id) {
      await db.update(pages).set(row).where(eq(pages.id, id));
    } else {
      const [created] = await db.insert(pages).values(row).returning({ id: pages.id });
      id = created.id;
    }

    const d = diff(before as unknown as Record<string, unknown> | undefined, row, [
      "slug",
      "title",
      "status",
      "seoTitle",
      "seoDescription",
    ]);
    await audit(ctx, {
      action: before ? "page.update" : "page.create",
      entityType: "page",
      entityId: id,
      entityLabel: values.title,
      before: d.before,
      after: d.after,
    });

    revalidateContent();
    revalidatePath(`/${values.slug}`);
    if (before && before.slug !== values.slug) revalidatePath(`/${before.slug}`);
    revalidatePath("/admin/content/pages");
    return { id: id! };
  });
}

export async function deletePageAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("content:write");
    const page = await db.query.pages.findFirst({ where: eq(pages.id, id) });
    if (!page) throw new ActionError("Page not found.");
    if (page.isSystem || (SYSTEM_PAGE_SLUGS as readonly string[]).includes(page.slug)) {
      throw new ActionError("This page backs a fixed storefront route and cannot be deleted. Set it to Draft instead.");
    }
    await db.update(pages).set({ deletedAt: new Date(), status: "draft" }).where(eq(pages.id, id));
    await audit(ctx, { action: "page.delete", entityType: "page", entityId: id, entityLabel: page.title });
    revalidateContent();
    revalidatePath("/admin/content/pages");
    return null;
  });
}

/* ------------------------------------------------------------------ blog */

export async function savePostAction(input: z.input<typeof blogPostSchema>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("content:write");
    const values = blogPostSchema.parse(input);

    const clash = await db.query.blogPosts.findFirst({
      where: and(eq(blogPosts.slug, values.slug), isNull(blogPosts.deletedAt)),
      columns: { id: true },
    });
    if (clash && clash.id !== values.id) throw new ActionError(`The slug "${values.slug}" is already used.`);

    const before = values.id ? await db.query.blogPosts.findFirst({ where: eq(blogPosts.id, values.id) }) : undefined;

    // A publish time in the future schedules the post; the storefront query
    // filters on it, so no cron job is needed.
    const publishedAt = values.publishedAt
      ? new Date(`${values.publishedAt}${values.publishedAt.includes("T") ? "" : "T09:00"}:00+05:00`)
      : values.status === "published"
        ? (before?.publishedAt ?? new Date())
        : null;

    const row = {
      slug: values.slug,
      title: values.title,
      excerpt: values.excerpt,
      body: values.body,
      coverImage: values.coverImage,
      authorName: values.authorName,
      tags: values.tags,
      status: values.status,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
      publishedAt,
      updatedAt: new Date(),
    };

    let id = values.id;
    if (id) {
      await db.update(blogPosts).set(row).where(eq(blogPosts.id, id));
    } else {
      const [created] = await db.insert(blogPosts).values(row).returning({ id: blogPosts.id });
      id = created.id;
    }

    await audit(ctx, {
      action: before ? "blog.update" : "blog.create",
      entityType: "blog_post",
      entityId: id,
      entityLabel: values.title,
      before: before ? { status: before.status, slug: before.slug } : undefined,
      after: { status: values.status, slug: values.slug, publishedAt },
    });

    revalidateContent();
    revalidatePath(`/blog/${values.slug}`);
    revalidatePath("/admin/content/blog");
    return { id: id! };
  });
}

export async function deletePostAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("content:write");
    const post = await db.query.blogPosts.findFirst({ where: eq(blogPosts.id, id) });
    if (!post) throw new ActionError("Post not found.");
    await db.update(blogPosts).set({ deletedAt: new Date(), status: "draft" }).where(eq(blogPosts.id, id));
    await audit(ctx, { action: "blog.delete", entityType: "blog_post", entityId: id, entityLabel: post.title });
    revalidateContent();
    revalidatePath("/admin/content/blog");
    return null;
  });
}

/* ------------------------------------------------------------------ menus */

export async function saveMenuAction(input: z.input<typeof menuSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("content:write");
    const values = menuSchema.parse(input);

    await db.transaction(async (tx) => {
      let menu = await tx.query.menus.findFirst({ where: eq(menus.handle, values.handle) });
      if (!menu) {
        const [created] = await tx
          .insert(menus)
          .values({ handle: values.handle, title: values.handle === "header" ? "Header" : "Footer" })
          .returning();
        menu = created;
      }

      await tx.delete(menuItems).where(eq(menuItems.menuId, menu.id));
      if (values.items.length === 0) return;

      // Insert parents first, then children, so parent ids resolve.
      const idMap = new Map<string, string>();
      const roots = values.items.filter((i) => !i.parentId);
      const children = values.items.filter((i) => i.parentId);

      for (const [position, item] of roots.entries()) {
        const [row] = await tx
          .insert(menuItems)
          .values({
            menuId: menu.id,
            parentId: null,
            label: item.label,
            url: item.url,
            resourceType: item.resourceType,
            resourceId: item.resourceId ?? null,
            position,
          })
          .returning({ id: menuItems.id });
        if (item.id) idMap.set(item.id, row.id);
      }

      for (const [position, item] of children.entries()) {
        const parentId = item.parentId ? idMap.get(item.parentId) : null;
        await tx.insert(menuItems).values({
          menuId: menu.id,
          parentId: parentId ?? null,
          label: item.label,
          url: item.url,
          resourceType: item.resourceType,
          resourceId: item.resourceId ?? null,
          position: roots.length + position,
        });
      }
    });

    await audit(ctx, {
      action: "menu.update",
      entityType: "menu",
      entityId: values.handle,
      entityLabel: values.handle,
      after: { items: values.items.length },
    });

    revalidateMenus();
    revalidatePath("/admin/content/menus");
    return null;
  });
}
