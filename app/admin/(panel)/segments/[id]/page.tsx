import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { customerSegments } from "@/lib/db/schema";
import { requireView } from "@/lib/admin/session";
import { parseRules, type RuleMatch } from "@/lib/admin/rules";
import { PageHeader } from "@/components/admin/ui";
import { SegmentForm } from "@/components/admin/SegmentForm";

export const metadata = { title: "Edit segment" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditSegmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireView("customers:write");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const segment = await db.query.customerSegments.findFirst({
    where: and(eq(customerSegments.id, id), isNull(customerSegments.deletedAt)),
  });
  if (!segment) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/segments", label: "Segments" }}
        title={segment.name}
        actions={
          <a href={`/api/admin/customers/export?segmentId=${segment.id}`} className="a-btn a-btn-xs" download>
            Export this segment
          </a>
        }
      />
      <SegmentForm
        initial={{
          id: segment.id,
          name: segment.name,
          description: segment.description,
          rulesMatch: segment.rulesMatch as RuleMatch,
          rules: parseRules(segment.rules),
        }}
      />
    </>
  );
}
