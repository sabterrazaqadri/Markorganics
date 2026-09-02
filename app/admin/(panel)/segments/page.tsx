import Link from "next/link";
import { desc, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { customerSegments } from "@/lib/db/schema";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { countCustomersMatching } from "@/lib/admin/customers";
import { describeRule, parseRules, type RuleMatch } from "@/lib/admin/rules";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { SegmentRowActions } from "@/components/admin/SegmentRowActions";

export const metadata = { title: "Segments" };
export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  const ctx = await requireView("customers:read");
  const rows = await db
    .select()
    .from(customerSegments)
    .where(isNull(customerSegments.deletedAt))
    .orderBy(desc(customerSegments.createdAt));

  const counts = await Promise.all(
    rows.map((s) => countCustomersMatching(parseRules(s.rules), s.rulesMatch as RuleMatch)),
  );
  const writable = can(ctx.user.role, "customers:write");

  return (
    <>
      <PageHeader
        title="Segments"
        subtitle="Saved rules over the customer table. Counts are computed live on every load."
        actions={
          writable ? (
            <Link href="/admin/segments/new" className="a-btn a-btn-primary a-btn-xs">
              New segment
            </Link>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState
            title="No segments yet"
            action={
              writable ? (
                <Link href="/admin/segments/new" className="a-btn a-btn-primary a-btn-xs">
                  New segment
                </Link>
              ) : null
            }
          >
            Try &ldquo;spent over Rs 5,000&rdquo;, &ldquo;no order in 90 days&rdquo; or &ldquo;more than two
            returns&rdquo;.
          </EmptyState>
        </div>
      ) : (
        <div className="a-card a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>Segment</th>
                <th>Conditions</th>
                <th className="a-num">Customers</th>
                <th style={{ width: 200 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      href={`/admin/segments/${s.id}`}
                      prefetch={false}
                      className="font-medium text-[var(--a-info)] hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.description ? <span className="block text-[11px] text-[var(--a-soft)]">{s.description}</span> : null}
                  </td>
                  <td className="max-w-[380px] text-[11.5px] text-[var(--a-soft)]">
                    {s.rulesMatch === "all" ? "All" : "Any"}:{" "}
                    {parseRules(s.rules)
                      .map((r) => describeRule(r, "customer"))
                      .join("; ") || "no conditions"}
                  </td>
                  <td className="a-num">{counts[i].toLocaleString("en-PK")}</td>
                  <td>
                    <SegmentRowActions id={s.id} canWrite={writable} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
