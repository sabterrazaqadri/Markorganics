import Link from "next/link";
import { getDashboardStats } from "@/lib/queries/orders";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { formatPKR } from "@/lib/money";
import { displayPkPhone } from "@/lib/phone";
import { abandonedCounts } from "@/lib/admin/abandoned";
import { Card, DateCell, EmptyState, OrderStatusPill, PageHeader, StatTile } from "@/components/admin/ui";
import { HealthStrip } from "@/components/admin/HealthStrip";
import { integrationHealth } from "@/lib/integrations/health";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireView("orders:read");
  const [s, abandoned, health] = await Promise.all([
    getDashboardStats(),
    can(ctx.user.role, "abandoned:read") ? abandonedCounts() : Promise.resolve(null),
    // Only the Owner can act on a failing integration, so only the Owner is told.
    can(ctx.user.role, "integrations:read") ? integrationHealth() : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title={`Good to see you, ${ctx.user.name.split(" ")[0]}`} subtitle="Everything that needs a decision today." />

      {health ? <HealthStrip health={health} /> : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Orders today" value={String(s.todayCount)} sub={formatPKR(s.todayRevenuePaisa)} />
        <StatTile
          label="Need a call"
          value={String(s.pendingCount)}
          sub="Pending confirmation"
          href="/admin/orders?view=pending"
          tone={s.pendingCount > 0 ? "warn" : undefined}
        />
        <StatTile label="Revenue, 7 days" value={formatPKR(s.weekRevenuePaisa)} sub={`${s.weekCount} orders`} />
        <StatTile
          label="Delivery success"
          value={s.deliveryRatePct === null ? "—" : `${s.deliveryRatePct}%`}
          sub="Delivered ÷ closed, 90 days"
          href={can(ctx.user.role, "analytics:read") ? "/admin/analytics" : undefined}
          tone={s.deliveryRatePct !== null && s.deliveryRatePct < 70 ? "danger" : "ok"}
        />
        {abandoned ? (
          <StatTile
            label="Abandoned checkouts"
            value={String(abandoned.open)}
            sub={`${formatPKR(abandoned.valuePaisa)} left in carts`}
            href="/admin/abandoned"
            tone={abandoned.open > 0 ? "warn" : undefined}
          />
        ) : (
          <StatTile label="Low stock" value={String(s.lowStockCount)} sub="At or under threshold" href="/admin/inventory?view=low" />
        )}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card
          title="Recent orders"
          actions={
            <Link href="/admin/orders" className="a-btn-link">
              All orders
            </Link>
          }
        >
          {s.recent.length === 0 ? (
            <EmptyState title="No orders yet">
              Orders appear here the moment a customer checks out. Until then, check that products are Active and the
              storefront shows them.
            </EmptyState>
          ) : (
            <div className="a-scroll">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>City</th>
                    <th className="a-num">Total</th>
                    <th>Status</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recent.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/orders/${o.id}`} prefetch={false} className="font-semibold text-[var(--a-info)] hover:underline">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td>
                        <span className="block max-w-[160px] truncate">{o.customerName}</span>
                        <span className="block text-[11.5px] text-[var(--a-soft)]">{displayPkPhone(o.phone)}</span>
                      </td>
                      <td className="max-w-[110px] truncate">{o.city}</td>
                      <td className="a-num">{formatPKR(o.totalPaisa)}</td>
                      <td>
                        <OrderStatusPill status={o.status} />
                      </td>
                      <td>
                        <DateCell value={o.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Low stock"
          actions={
            can(ctx.user.role, "inventory:read") ? (
              <Link href="/admin/inventory?view=low" className="a-btn-link">
                Inventory
              </Link>
            ) : null
          }
        >
          {s.lowStock.length === 0 ? (
            <EmptyState title="Stock looks healthy">Every variant is above its low-stock threshold.</EmptyState>
          ) : (
            <ul className="divide-y divide-[var(--a-border)]">
              {s.lowStock.map((v) => (
                <li key={v.variantId} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/inventory/${v.variantId}`}
                      prefetch={false}
                      className="block truncate text-[12.5px] font-medium text-[var(--a-info)] hover:underline"
                    >
                      {v.productName}
                    </Link>
                    <span className="block truncate text-[11px] text-[var(--a-soft)]">
                      {v.label} &middot; {v.sku}
                    </span>
                  </div>
                  <span className={`a-num font-semibold ${v.stock === 0 ? "text-[var(--a-danger)]" : "text-[var(--a-warn)]"}`}>
                    {v.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
