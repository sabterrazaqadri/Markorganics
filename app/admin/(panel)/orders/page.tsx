import Link from "next/link";
import { listOrders, countOrders, orderViewCounts, distinctOrderCities, distinctOrderTags } from "@/lib/queries/orders";
import { ordersFilterSchema, ORDER_VIEWS, ORDER_VIEW_LABEL, type OrderView } from "@/lib/validation/admin";
import { ORDER_STATUSES } from "@/lib/db/schema";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { listSavedViews } from "@/lib/admin/saved-views";
import { listUsers } from "@/lib/admin/users";
import { PageHeader, CursorPager, EmptyState, ORDER_STATUS_LABEL } from "@/components/admin/ui";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { SavedViewBar } from "@/components/admin/SavedViewBar";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

function flatten(sp: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) out[k] = value;
  }
  return out;
}

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requireView("orders:read");
  const raw = flatten(await searchParams);
  const parsed = ordersFilterSchema.safeParse(raw);
  const filter = parsed.success ? parsed.data : ordersFilterSchema.parse({});
  const view: OrderView = filter.view ?? "all";

  const [{ rows, nextCursor }, counts, total, cities, tags, staff, savedViews] = await Promise.all([
    listOrders(filter),
    orderViewCounts(),
    countOrders(filter),
    distinctOrderCities(),
    distinctOrderTags(),
    can(ctx.user.role, "staff:read") ? listUsers() : Promise.resolve([]),
    listSavedViews("orders", ctx.user.id),
  ]);

  const queryString = new URLSearchParams(
    Object.entries(raw).filter(([k]) => k !== "cursor") as [string, string][],
  ).toString();
  const exportHref = `/api/admin/orders/export${queryString ? `?${queryString}` : ""}`;

  const tabHref = (v: OrderView) => {
    const qs = new URLSearchParams(raw);
    qs.delete("cursor");
    if (v === "all") qs.delete("view");
    else qs.set("view", v);
    const q = qs.toString();
    return q ? `/admin/orders?${q}` : "/admin/orders";
  };

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${total.toLocaleString("en-PK")} matching this filter`}
        actions={
          <>
            {can(ctx.user.role, "drafts:write") ? (
              <Link href="/admin/drafts/new" className="a-btn a-btn-xs">
                New draft order
              </Link>
            ) : null}
            {can(ctx.user.role, "orders:export") ? (
              <a href={exportHref} className="a-btn a-btn-xs" download>
                Export CSV
              </a>
            ) : null}
          </>
        }
      />

      <nav aria-label="Order views" className="a-tabs mb-3">
        {ORDER_VIEWS.map((v) => (
          <Link key={v} href={tabHref(v)} className="a-tab" aria-current={view === v ? "page" : undefined}>
            {ORDER_VIEW_LABEL[v]}
            {counts[v] ? <span className="ml-1.5 text-[var(--a-soft)]">{counts[v]}</span> : null}
          </Link>
        ))}
      </nav>

      <SavedViewBar resource="orders" views={savedViews} currentQuery={queryString} />

      <form method="get" className="a-card mb-3 grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {filter.view ? <input type="hidden" name="view" value={filter.view} /> : null}
        <div className="sm:col-span-2">
          <label htmlFor="q" className="a-label">
            Search
          </label>
          <input id="q" name="q" className="a-input" defaultValue={filter.q ?? ""} placeholder="Order number, phone or name" />
        </div>
        <div>
          <label htmlFor="status" className="a-label">
            Status
          </label>
          <select id="status" name="status" className="a-select" defaultValue={filter.status ?? ""}>
            <option value="">Any</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
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
          <label htmlFor="tag" className="a-label">
            Tag
          </label>
          <select id="tag" name="tag" className="a-select" defaultValue={filter.tag ?? ""}>
            <option value="">Any</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="actor" className="a-label">
            Last touched by
          </label>
          <select id="actor" name="actor" className="a-select" defaultValue={filter.actor ?? ""} disabled={staff.length === 0}>
            <option value="">Anyone</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="a-label">
            From
          </label>
          <input id="from" name="from" type="date" className="a-input" defaultValue={filter.from ?? ""} />
        </div>
        <div>
          <label htmlFor="to" className="a-label">
            To
          </label>
          <input id="to" name="to" type="date" className="a-input" defaultValue={filter.to ?? ""} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="minTotal" className="a-label">
              Min Rs
            </label>
            <input id="minTotal" name="minTotal" type="number" min="0" className="a-input" defaultValue={filter.minTotal ?? ""} />
          </div>
          <div>
            <label htmlFor="maxTotal" className="a-label">
              Max Rs
            </label>
            <input id="maxTotal" name="maxTotal" type="number" min="0" className="a-input" defaultValue={filter.maxTotal ?? ""} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="minItems" className="a-label">
              Min items
            </label>
            <input id="minItems" name="minItems" type="number" min="0" className="a-input" defaultValue={filter.minItems ?? ""} />
          </div>
          <div>
            <label htmlFor="maxItems" className="a-label">
              Max items
            </label>
            <input id="maxItems" name="maxItems" type="number" min="0" className="a-input" defaultValue={filter.maxItems ?? ""} />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="a-btn a-btn-primary">
            Filter
          </button>
          <Link href={filter.view ? `/admin/orders?view=${filter.view}` : "/admin/orders"} className="a-btn">
            Clear
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState title="No orders match this filter">
            Widen the date range or clear the filters. New orders land here the moment a customer checks out.
          </EmptyState>
        </div>
      ) : (
        <OrdersTable rows={rows} canWrite={can(ctx.user.role, "orders:write")} />
      )}

      <CursorPager basePath="/admin/orders" params={raw} nextCursor={nextCursor} hasCursor={Boolean(filter.cursor)} />
    </>
  );
}
