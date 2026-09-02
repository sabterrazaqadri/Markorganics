import Link from "next/link";
import { desc, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { customerSegments } from "@/lib/db/schema";
import { requireView } from "@/lib/admin/session";
import {
  assessRisk,
  countCustomers,
  deliveryRate,
  distinctCustomerCities,
  listCustomers,
} from "@/lib/admin/customers";
import { customersFilterSchema } from "@/lib/validation/admin";
import { listSavedViews } from "@/lib/admin/saved-views";
import { formatPKR } from "@/lib/money";
import { displayPkPhone } from "@/lib/phone";
import { CursorPager, DateCell, EmptyState, PageHeader } from "@/components/admin/ui";
import { SavedViewBar } from "@/components/admin/SavedViewBar";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireView("customers:read");
  const sp = await searchParams;
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) raw[k] = value;
  }

  const parsed = customersFilterSchema.safeParse(raw);
  const filter = parsed.success ? parsed.data : customersFilterSchema.parse({});

  const [{ rows, nextCursor }, total, cities, segments, savedViews] = await Promise.all([
    listCustomers(filter),
    countCustomers(filter),
    distinctCustomerCities(),
    db
      .select()
      .from(customerSegments)
      .where(isNull(customerSegments.deletedAt))
      .orderBy(desc(customerSegments.createdAt)),
    listSavedViews("customers", ctx.user.id),
  ]);

  const queryString = new URLSearchParams(Object.entries(raw).filter(([k]) => k !== "cursor")).toString();
  const exportHref = `/api/admin/customers/export${queryString ? `?${queryString}` : ""}`;

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${total.toLocaleString("en-PK")} matching · keyed on the +92 phone number`}
        actions={
          <>
            <Link href="/admin/customers/duplicates" className="a-btn a-btn-xs">
              Find duplicates
            </Link>
            <a href={exportHref} className="a-btn a-btn-xs" download>
              Export CSV
            </a>
          </>
        }
      />

      <SavedViewBar resource="customers" views={savedViews} currentQuery={queryString} />

      <form method="get" className="a-card mb-3 grid gap-2 p-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="sm:col-span-2">
          <label htmlFor="q" className="a-label">
            Search
          </label>
          <input id="q" name="q" className="a-input" defaultValue={filter.q ?? ""} placeholder="Name, phone or email" />
        </div>
        <div>
          <label htmlFor="city" className="a-label">
            City
          </label>
          <select id="city" name="city" className="a-select" defaultValue={filter.city ?? ""}>
            <option value="">Any</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="segmentId" className="a-label">
            Segment
          </label>
          <select id="segmentId" name="segmentId" className="a-select" defaultValue={filter.segmentId ?? ""}>
            <option value="">Everyone</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="a-label">
            Sort
          </label>
          <select id="sort" name="sort" className="a-select" defaultValue={filter.sort}>
            <option value="recent">Most recent order</option>
            <option value="spend">Lifetime spend</option>
            <option value="orders">Order count</option>
            <option value="risk">Most returns</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="a-btn a-btn-primary">
            Filter
          </button>
          <Link href="/admin/customers" className="a-btn">
            Clear
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState title="No customers match">
            Customers are created automatically from every order. If this list is empty on a store with orders, run{" "}
            <code className="a-mono">npm run db:backfill</code> once.
          </EmptyState>
        </div>
      ) : (
        <div className="a-card a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>City</th>
                <th className="a-num">Orders</th>
                <th className="a-num">Lifetime</th>
                <th className="a-num">AOV</th>
                <th className="a-num">Delivery rate</th>
                <th>Tags</th>
                <th>Last order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const risk = assessRisk(c);
                const rate = deliveryRate(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/admin/customers/${c.id}`}
                        prefetch={false}
                        className="block max-w-[200px] truncate font-medium text-[var(--a-info)] hover:underline"
                      >
                        {c.name || displayPkPhone(c.phone)}
                      </Link>
                      <span className="block text-[11.5px] text-[var(--a-soft)]">
                        {displayPkPhone(c.phone)}
                        {risk.level !== "none" ? (
                          <span
                            className={`a-badge ml-1.5 ${risk.level === "high" ? "a-badge-danger" : "a-badge-warn"}`}
                            title={risk.reason}
                          >
                            {risk.level === "high" ? "high risk" : "watch"}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="max-w-[110px] truncate">{c.city || "—"}</td>
                    <td className="a-num">{c.ordersCount}</td>
                    <td className="a-num">{formatPKR(c.totalSpentPaisa)}</td>
                    <td className="a-num">{formatPKR(c.avgOrderPaisa)}</td>
                    <td className={`a-num ${rate !== null && rate < 60 ? "text-[var(--a-danger)]" : ""}`}>
                      {rate === null ? "—" : `${rate}%`}
                    </td>
                    <td>
                      <span className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 2).map((t) => (
                          <span key={t} className="a-tag">
                            {t}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td>
                      <DateCell value={c.lastOrderAt} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CursorPager basePath="/admin/customers" params={raw} nextCursor={nextCursor} hasCursor={Boolean(filter.cursor)} />
    </>
  );
}
