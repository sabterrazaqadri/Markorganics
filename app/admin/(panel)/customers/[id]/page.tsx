import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import {
  assessRisk,
  deliveryRate,
  getCustomerAddresses,
  getCustomerById,
  getCustomerOrders,
} from "@/lib/admin/customers";
import { formatPKR } from "@/lib/money";
import { displayPkPhone, waNumber } from "@/lib/phone";
import { markThreadRead, recentMessagesFor } from "@/lib/whatsapp/client";
import { WhatsappThread } from "@/components/admin/WhatsappThread";
import { Card, DateCell, EmptyState, OrderStatusPill, PageHeader, StatTile } from "@/components/admin/ui";
import { CustomerEditor } from "@/components/admin/CustomerEditor";

export const metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireView("customers:read");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const [orders, addresses, messages] = await Promise.all([
    getCustomerOrders(id),
    getCustomerAddresses(id),
    recentMessagesFor(customer.phone),
  ]);

  // Opening the profile is what "reading" a WhatsApp reply means here, so the
  // unread badge clears from the moment somebody actually looks.
  if (messages.some((m) => m.direction === "inbound" && !m.isRead)) {
    await markThreadRead(customer.phone);
  }
  const risk = assessRisk(customer);
  const rate = deliveryRate(customer);

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/customers", label: "Customers" }}
        title={customer.name || displayPkPhone(customer.phone)}
        subtitle={
          <>
            <a href={`tel:${customer.phone}`} className="text-[var(--a-info)] hover:underline">
              {displayPkPhone(customer.phone)}
            </a>
            {customer.email ? ` · ${customer.email}` : ""}
            {customer.firstOrderAt ? ` · first ordered ${new Date(customer.firstOrderAt).getFullYear()}` : ""}
          </>
        }
        actions={
          <a
            href={`https://wa.me/${waNumber(customer.phone)}`}
            target="_blank"
            rel="noopener"
            className="a-btn a-btn-xs"
          >
            WhatsApp
          </a>
        }
      />

      {customer.mergedIntoId ? (
        <p className="mb-3 rounded border border-[var(--a-border)] bg-[var(--a-warn-bg)] px-2.5 py-2 text-[12px] text-[var(--a-warn)]">
          This record was merged into{" "}
          <Link href={`/admin/customers/${customer.mergedIntoId}`} className="underline">
            another customer
          </Link>
          . It is kept so old audit entries still resolve.
        </p>
      ) : null}

      {risk.level !== "none" ? (
        <p
          className={`mb-3 rounded border px-2.5 py-2 text-[12px] ${
            risk.level === "high"
              ? "border-[#e8b4b0] bg-[var(--a-danger-bg)] text-[var(--a-danger)]"
              : "border-[#e6cfa0] bg-[var(--a-warn-bg)] text-[var(--a-warn)]"
          }`}
        >
          <strong>{risk.level === "high" ? "High COD risk." : "Watch this one."}</strong> {risk.reason}
        </p>
      ) : null}

      <div className="mb-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Orders" value={String(customer.ordersCount)} />
        <StatTile label="Lifetime spend" value={formatPKR(customer.totalSpentPaisa)} />
        <StatTile label="Average order" value={formatPKR(customer.avgOrderPaisa)} />
        <StatTile
          label="Delivery rate"
          value={rate === null ? "—" : `${rate}%`}
          tone={rate !== null && rate < 60 ? "danger" : rate !== null ? "ok" : undefined}
        />
        <StatTile label="Cancelled" value={String(customer.cancelledCount)} tone={customer.cancelledCount ? "warn" : undefined} />
        <StatTile label="Returned" value={String(customer.returnedCount)} tone={customer.returnedCount ? "danger" : undefined} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <Card title={`Orders (${orders.length})`}>
            {orders.length === 0 ? (
              <EmptyState title="No orders yet">This customer record exists but has no orders attached.</EmptyState>
            ) : (
              <div className="a-scroll">
                <table className="a-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Status</th>
                      <th>City</th>
                      <th className="a-num">Items</th>
                      <th className="a-num">Total</th>
                      <th>Placed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link href={`/admin/orders/${o.id}`} prefetch={false} className="font-medium text-[var(--a-info)] hover:underline">
                            {o.orderNumber}
                          </Link>
                        </td>
                        <td>
                          <OrderStatusPill status={o.status} />
                        </td>
                        <td className="max-w-[110px] truncate">{o.city}</td>
                        <td className="a-num">{o.itemCount}</td>
                        <td className="a-num">{formatPKR(o.totalPaisa)}</td>
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

          <Card title="Addresses used">
            {addresses.length === 0 ? (
              <p className="p-3 text-[12px] text-[var(--a-soft)]">No delivery addresses on record.</p>
            ) : (
              <ul className="divide-y divide-[var(--a-border)]">
                {addresses.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-[12.5px]">
                    <span>
                      {a.address}
                      <span className="block text-[11.5px] text-[var(--a-soft)]">{a.city}</span>
                    </span>
                    <DateCell value={a.lastUsed} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-3">
          <WhatsappThread
            phone={customer.phone}
            messages={messages.map((m) => ({
              id: m.id,
              direction: m.direction,
              body: m.body,
              templateName: m.templateName,
              status: m.status,
              error: m.error,
              dryRun: m.dryRun,
              isRead: m.isRead,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
          <CustomerEditor
            customer={{
              id: customer.id,
              name: customer.name,
              email: customer.email ?? "",
              city: customer.city,
              tags: customer.tags,
              internalNote: customer.internalNote,
              phone: customer.phone,
            }}
            canWrite={can(ctx.user.role, "customers:write")}
          />
        </div>
      </div>
    </>
  );
}
