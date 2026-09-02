import { requireView } from "@/lib/admin/session";
import { PageHeader } from "@/components/admin/ui";
import { CollectionForm, EMPTY_COLLECTION } from "@/components/admin/CollectionForm";

export const metadata = { title: "New collection" };
export const dynamic = "force-dynamic";

export default async function NewCollectionPage() {
  await requireView("collections:write");
  return (
    <>
      <PageHeader breadcrumb={{ href: "/admin/collections", label: "Collections" }} title="New collection" />
      <CollectionForm initial={EMPTY_COLLECTION} />
    </>
  );
}
