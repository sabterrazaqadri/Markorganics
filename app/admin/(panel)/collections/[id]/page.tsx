import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/admin/session";
import { getCollection, getCollectionMembers } from "@/lib/admin/collections";
import { parseRules } from "@/lib/admin/rules";
import { PageHeader, Card } from "@/components/admin/ui";
import { CollectionForm, type CollectionFormValues } from "@/components/admin/CollectionForm";

export const metadata = { title: "Edit collection" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireView("collections:write");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const collection = await getCollection(id);
  if (!collection) notFound();
  const members = await getCollectionMembers(id);

  const initial: CollectionFormValues = {
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description,
    type: collection.type,
    rulesMatch: collection.rulesMatch,
    rules: parseRules(collection.rules),
    image: collection.image,
    isPublished: collection.isPublished,
    sortOrder: String(collection.sortOrder),
    seoTitle: collection.seoTitle,
    seoDescription: collection.seoDescription,
    productIds: members.map((m) => m.id),
  };

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/collections", label: "Collections" }}
        title={collection.title}
        subtitle={`/${collection.slug} · ${members.length} products`}
      />
      <CollectionForm initial={initial} />

      {collection.type === "automatic" && members.length ? (
        <div className="mt-3">
          <Card title={`Current members (${members.length})`}>
            <ul className="grid gap-0.5 p-3 text-[12px] sm:grid-cols-3">
              {members.map((m) => (
                <li key={m.id} className="truncate">
                  <Link href={`/admin/products/${m.id}`} prefetch={false} className="text-[var(--a-info)] hover:underline">
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </>
  );
}
