import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { abandonedCounts, listAbandoned } from "@/lib/admin/abandoned";
import { getStoreSettings } from "@/lib/settings";
import { formatPKR } from "@/lib/money";
import { displayPkPhone, waNumber } from "@/lib/phone";
import { CursorPager, DateCell, EmptyState, PageHeader, StatTile } from "@/components/admin/ui";
import { AbandonedRowActions } from "@/components/admin/AbandonedRowActions";

export const metadata = { title: "Abandoned checkouts" };
export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "open", label: "Open" },
  { key: "recovered", label: "Recovered" },
  { key: "dismissed", label: "Dismissed" },
] as const;

export default async function AbandonedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cursor?: string }>;
}) {
  const ctx = await requireView("abandoned:read");
  const sp = await searchParams;
  const status = (VIEWS.find((v) => v.key === sp.status)?.key ?? "open") as "open" | "recovered" | "dismissed";

  const [{ rows, nextCursor }, counts, store] = await Promise.all([
    listAbandoned({ status, cursor: sp.cursor }),
    abandonedCounts(),
    getStoreSettings(),
  ]);

  const writable = can(ctx.user.role, "abandoned:write");
  const recoveryRate = counts.open + counts.recovered > 0
    ? Math.round((counts.recovered / (counts.open + counts.recovered)) * 100)
    : null;

  return (
    <>
      <PageHeader
        title="Abandoned checkouts"
        subtitle="Someone typed their number and cart, then never submitted. One WhatsApp message often finishes the sale."
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Open" value={String(counts.open)} tone={counts.open ? "warn" : undefined} />
        <StatTile label="Value left in carts" value={formatPKR(counts.valuePaisa)} />
        <StatTile label="Recovered" value={String(counts.recovered)} tone="ok" />
        <StatTile label="Recovery rate" value={recoveryRate === null ? "—" : `${recoveryRate}%`} />
      </div>

      <nav aria-label="Checkout status" className="a-tabs mb-3">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "open" ? "/admin/abandoned" : `/admin/abandoned?status=${v.key}`}
            className="a-tab"
            aria-current={status === v.key ? "page" : undefined}
          >
            {v.label} <span className="ml-1.5 text-[var(--a-soft)]">{counts[v.key]}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState title="Nothing here">
            {status === "open"
              ? "No abandoned checkouts in the last while. A checkout only lands here ten minutes after the customer stops typing."
              : "Nothing in this list yet."}
          </EmptyState>
        </div>
      ) : (
        <div className="a-card a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>City</th>
                <th>Cart</th>
                <th className="a-num">Items</th>
                <th className="a-num">Value</th>
                <th>Started</th>
                <th style={{ width: 200 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const message = encodeURIComponent(
                  `Assalam o Alaikum${row.name ? ` ${row.name}` : ""}, this is ${store.name}. We saw you were ordering ${row.cartLines
                    .map((l) => `${l.quantity} x ${l.productName}`)
                    .join(", ")} for ${formatPKR(row.subtotalPaisa)}. Would you like us to place it for you? Cash on delivery, ${row.city || "anywhere in Pakistan"}.`,
                );
                return (
                  <tr key={row.id}>
                    <td>
                      <span className="block max-w-[180px] truncate">{row.name || "No name given"}</span>
                      <span className="block text-[11.5px] text-[var(--a-soft)]">
                        {row.phone ? displayPkPhone(row.phone) : "no phone"}
                        {row.customerOrders ? (
                          <span className="a-badge a-badge-info ml-1.5">{row.customerOrders} past orders</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="max-w-[110px] truncate">{row.city || "—"}</td>
                    <td className="max-w-[280px] text-[11.5px] text-[var(--a-soft)]">
                      {row.cartLines.map((l) => `${l.quantity} × ${l.productName} ${l.variantLabel}`).join(", ") || "—"}
                    </td>
                    <td className="a-num">{row.itemCount}</td>
                    <td className="a-num">{formatPKR(row.subtotalPaisa)}</td>
                    <td>
                      <DateCell value={row.createdAt} />
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        {row.phone ? (
                          <a
                            href={`https://wa.me/${waNumber(row.phone)}?text=${message}`}
                            target="_blank"
                            rel="noopener"
                            className="a-btn a-btn-xs"
                          >
                            WhatsApp
                          </a>
                        ) : null}
                        {row.recoveredOrderId ? (
                          <Link href={`/admin/orders/${row.recoveredOrderId}`} prefetch={false} className="a-btn-link">
                            Order
                          </Link>
                        ) : null}
                        {writable && status !== "recovered" ? (
                          <AbandonedRowActions id={row.id} status={row.status} />
                        ) : null}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CursorPager
        basePath="/admin/abandoned"
        params={{ status: status === "open" ? undefined : status }}
        nextCursor={nextCursor}
        hasCursor={Boolean(sp.cursor)}
      />
    </>
  );
}
