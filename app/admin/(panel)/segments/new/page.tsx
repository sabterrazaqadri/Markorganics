import { requireView } from "@/lib/admin/session";
import { PageHeader } from "@/components/admin/ui";
import { EMPTY_SEGMENT, SegmentForm } from "@/components/admin/SegmentForm";

export const metadata = { title: "New segment" };
export const dynamic = "force-dynamic";

export default async function NewSegmentPage() {
  await requireView("customers:write");
  return (
    <>
      <PageHeader breadcrumb={{ href: "/admin/segments", label: "Segments" }} title="New segment" />
      <SegmentForm initial={EMPTY_SEGMENT} />
    </>
  );
}
