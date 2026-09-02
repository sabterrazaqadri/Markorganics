import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { listDrafts } from "@/lib/admin/drafts";
import { formatPKR } from "@/lib/money";
import { displayPkPhone } from "@/lib/phone";
import { DateCell, EmptyState, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Draft orders" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  open: "a-badge-warn",
  completed: "a-badge-ok",
  cancelled: "a-badge-neutral",
};

export default async function DraftsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireView("drafts:read");
  const sp = await searchParams;
  const status = sp.status === "completed" || sp.status === "cancelled" ? sp.status : "open";
  const rows = await listDrafts(status);
  const writable = can(ctx.user.role, "drafts:write");

  return (
    <>
      <PageHeader
        title="Draft orders"
        subtitle="Phone orders, wholesale and replacements. Nothing here reserves stock until it is converted."
        actions={
          writable ? (
            <Link href="/admin/drafts/new" className="a-btn a-btn-primary a-btn-xs">
              New draft order
            </Link>
          ) : null
        }
      />

      <nav aria-label="Draft status" className="a-tabs mb-3">
        {(["open", "completed", "cancelled"] as const).map((s) => (
          <Link
            key={s}
            href={s === "open" ? "/admin/drafts" : `/admin/drafts?status=${s}`}
            className="a-tab"
            aria-current={status === s ? "page" : undefined}
          >
            {s === "open" ? "Open" : s === "completed" ? "Converted" : "Cancelled"}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState
            title={status === "open" ? "No open drafts" : "Nothing here"}
            action={
              writable ? (
                <Link href="/admin/drafts/new" className="a-btn a-btn-primary a-btn-xs">
                  New draft order
                </Link>
              ) : null
            }
          >
            Take a phone order without touching the storefront: pick a customer, add lines, then convert it when they
            confirm.
          </EmptyState>
        </div>
      ) : (
        <div className="a-card a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>City</th>
                <th className="a-num">Items</th>
                <th className="a-num">Total</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/admin/drafts/${d.id}`} prefetch={false} className="font-medium text-[var(--a-info)] hover:underline">
                      {d.customerName || "Unnamed draft"}
                    </Link>
                    <span className="block text-[11.5px] text-[var(--a-soft)]">
                      {d.phone ? displayPkPhone(d.phone) : "no phone yet"}
                    </span>
                  </td>
                  <td className="max-w-[120px] truncate">{d.city || "—"}</td>
                  <td className="a-num">{d.items.reduce((n, i) => n + i.quantity, 0)}</td>
                  <td className="a-num">{formatPKR(d.totalPaisa)}</td>
                  <td>
                    <span className={`a-badge ${STATUS_BADGE[d.status]}`}>{d.status}</span>
                  </td>
                  <td>
                    <DateCell value={d.createdAt} />
                  </td>
                  <td>
                    {d.convertedOrderId ? (
                      <Link href={`/admin/orders/${d.convertedOrderId}`} prefetch={false} className="a-btn-link">
                        View order
                      </Link>
                    ) : (
                      <Link href={`/admin/drafts/${d.id}`} prefetch={false} className="a-btn-link">
                        Open
                      </Link>
                    )}
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
