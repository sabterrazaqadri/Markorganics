import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { findDuplicateCandidates } from "@/lib/admin/customers";
import { displayPkPhone } from "@/lib/phone";
import { EmptyState, PageHeader, Card } from "@/components/admin/ui";

export const metadata = { title: "Duplicate customers" };
export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  await requireView("customers:read");
  const groups = await findDuplicateCandidates();

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/customers", label: "Customers" }}
        title="Possible duplicates"
        subtitle="Records sharing a name across different phone numbers. Open one and merge the other into it."
      />

      {groups.length === 0 ? (
        <div className="a-card">
          <EmptyState title="No obvious duplicates">
            Nobody shares a name across two phone numbers. Merging is still available on any customer page.
          </EmptyState>
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--a-border)]">
            {groups.map((group, i) => (
              <li key={i} className="px-3 py-2">
                <p className="text-[12.5px] font-medium">{group.name}</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {group.ids.map((id, j) => (
                    <li key={id}>
                      <Link href={`/admin/customers/${id}`} prefetch={false} className="a-btn a-btn-xs">
                        {displayPkPhone(group.phones[j])}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
