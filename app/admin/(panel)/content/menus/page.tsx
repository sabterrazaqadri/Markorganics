import { asc, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { collections, pages, products } from "@/lib/db/schema";
import { requireView } from "@/lib/admin/session";
import { getMenuRows } from "@/lib/content";
import { FAMILIES, FAMILY_ORDER } from "@/lib/catalog";
import { Card, PageHeader } from "@/components/admin/ui";
import { MenuEditor, type LinkOption, type MenuItemDraft } from "@/components/admin/MenuEditor";

export const metadata = { title: "Navigation" };
export const dynamic = "force-dynamic";

export default async function MenusPage() {
  await requireView("content:write");

  const [header, footer, productRows, collectionRows, pageRows] = await Promise.all([
    getMenuRows("header"),
    getMenuRows("footer"),
    db.select({ id: products.id, name: products.name, slug: products.slug }).from(products).where(isNull(products.deletedAt)).orderBy(asc(products.name)).limit(200),
    db
      .select({ id: collections.id, title: collections.title, slug: collections.slug })
      .from(collections)
      .where(isNull(collections.deletedAt))
      .orderBy(asc(collections.title))
      .limit(100),
    db.select({ id: pages.id, title: pages.title, slug: pages.slug }).from(pages).where(isNull(pages.deletedAt)).orderBy(asc(pages.title)).limit(100),
  ]);

  const links: LinkOption[] = [
    ...FAMILY_ORDER.map((f) => ({
      value: `collection:family-${f}`,
      label: FAMILIES[f].heading,
      group: "Families",
      url: `/collections/${f}`,
      resourceType: "collection" as const,
      resourceId: `family-${f}`,
    })),
    ...collectionRows.map((c) => ({
      value: `collection:${c.id}`,
      label: c.title,
      group: "Collections",
      url: `/collections/${c.slug}`,
      resourceType: "collection" as const,
      resourceId: c.id,
    })),
    ...productRows.map((p) => ({
      value: `product:${p.id}`,
      label: p.name,
      group: "Products",
      url: `/products/${p.slug}`,
      resourceType: "product" as const,
      resourceId: p.id,
    })),
    ...pageRows.map((p) => ({
      value: `page:${p.id}`,
      label: p.title,
      group: "Pages",
      url: `/${p.slug}`,
      resourceType: "page" as const,
      resourceId: p.id,
    })),
  ];

  const toDrafts = (items: typeof header.items): MenuItemDraft[] =>
    items.map((i) => ({
      id: i.id,
      parentId: i.parentId,
      label: i.label,
      url: i.url,
      resourceType: i.resourceType as MenuItemDraft["resourceType"],
      resourceId: i.resourceId ?? "",
    }));

  return (
    <>
      <PageHeader
        title="Navigation"
        subtitle="The storefront header and footer read these from the database with a one-hour cache."
      />

      <div className="space-y-3">
        <Card title="Header menu">
          <div className="p-3">
            <MenuEditor handle="header" initial={toDrafts(header.items)} links={links} />
          </div>
        </Card>

        <Card title="Footer menu">
          <div className="p-3">
            <MenuEditor handle="footer" initial={toDrafts(footer.items)} links={links} />
          </div>
        </Card>
      </div>
    </>
  );
}
