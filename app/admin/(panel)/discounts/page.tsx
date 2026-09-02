import Link from "next/link";
import { desc, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { discounts } from "@/lib/db/schema";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { discountState, formatDiscountValue } from "@/lib/discounts";
import { formatPKR } from "@/lib/money";
import { DateCell, EmptyState, PageHeader } from "@/components/admin/ui";
import { DiscountRowActions } from "@/components/admin/DiscountRowActions";

export const metadata = { title: "Discounts" };
export const dynamic = "force-dynamic";

const STATE_BADGE: Record<string, string> = {
  active: "a-badge-ok",
  scheduled: "a-badge-info",
  expired: "a-badge-neutral",
  disabled: "a-badge-neutral",
  "used up": "a-badge-warn",
};

export default async function DiscountsPage() {
  const ctx = await requireView("discounts:read");
  const rows = await db.select().from(discounts).where(isNull(discounts.deletedAt)).orderBy(desc(discounts.createdAt));
  const writable = can(ctx.user.role, "discounts:write");

  return (
    <>
      <PageHeader
        title="Discounts"
        subtitle="Codes and automatic offers. Every amount is recalculated server-side inside the order transaction."
        actions={
          writable ? (
            <Link href="/admin/discounts/new" className="a-btn a-btn-primary a-btn-xs">
              New discount
            </Link>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState
            title="No discounts yet"
            action={
              writable ? (
                <Link href="/admin/discounts/new" className="a-btn a-btn-primary a-btn-xs">
                  New discount
                </Link>
              ) : null
            }
          >
            Create a code for a campaign, or an automatic offer that applies itself when the cart qualifies.
          </EmptyState>
        </div>
      ) : (
        <div className="a-card a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>Discount</th>
                <th>Code</th>
                <th>Value</th>
                <th>Status</th>
                <th className="a-num">Uses</th>
                <th className="a-num">Given away</th>
                <th className="a-num">Revenue</th>
                <th>Window</th>
                <th style={{ width: 170 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const state = discountState(d);
                return (
                  <tr key={d.id}>
                    <td>
                      <Link
                        href={`/admin/discounts/${d.id}`}
                        prefetch={false}
                        className="font-medium text-[var(--a-info)] hover:underline"
                      >
                        {d.title}
                      </Link>
                      <span className="block text-[11px] text-[var(--a-soft)]">
                        {d.method === "code" ? "Code" : "Automatic"} ·{" "}
                        {d.appliesTo === "order" ? "entire order" : d.appliesTo}
                      </span>
                    </td>
                    <td className="a-mono">{d.code ?? "—"}</td>
                    <td>{formatDiscountValue(d)}</td>
                    <td>
                      <span className={`a-badge ${STATE_BADGE[state]}`}>{state}</span>
                    </td>
                    <td className="a-num">
                      {d.usageCount}
                      {d.usageLimit ? <span className="text-[var(--a-soft)]"> / {d.usageLimit}</span> : null}
                    </td>
                    <td className="a-num">{formatPKR(d.discountedPaisa)}</td>
                    <td className="a-num">{formatPKR(d.revenuePaisa)}</td>
                    <td className="text-[11.5px] text-[var(--a-soft)]">
                      <DateCell value={d.startsAt} />
                      {d.endsAt ? (
                        <>
                          {" → "}
                          <DateCell value={d.endsAt} />
                        </>
                      ) : null}
                    </td>
                    <td>
                      <DiscountRowActions id={d.id} isEnabled={d.isEnabled} canWrite={writable} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
