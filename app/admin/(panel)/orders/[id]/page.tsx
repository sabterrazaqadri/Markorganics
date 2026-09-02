import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/queries/orders";
import { getPreviousOrdersByPhone, assessRisk, deliveryRate } from "@/lib/admin/customers";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { formatPKR } from "@/lib/money";
import { displayPkPhone, waNumber } from "@/lib/phone";
import { getStoreSettings } from "@/lib/settings";
import { Card, DateCell, Money, OrderStatusPill, PageHeader, ORDER_STATUS_LABEL } from "@/components/admin/ui";
import { OrderSidebar } from "@/components/admin/OrderSidebar";
import { OrderEditor } from "@/components/admin/OrderEditor";
import { OrderTimeline } from "@/components/admin/OrderTimeline";

export const metadata = { title: "Order" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireView("orders:read");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const order = await getOrderById(id);
  if (!order) notFound();

  const [previous, store] = await Promise.all([
    getPreviousOrdersByPhone(order.phone, order.id),
    getStoreSettings(),
  ]);

  const customer = order.customer;
  const risk = customer ? assessRisk(customer) : { level: "none" as const, reason: "" };
  const rate = customer ? deliveryRate(customer) : null;
  const editable = can(ctx.user.role, "orders:edit") && !["shipped", "delivered"].includes(order.status);

  const addressText = [
    order.customerName,
    displayPkPhone(order.phone) + (order.altPhone ? ` / ${displayPkPhone(order.altPhone)}` : ""),
    order.address,
    order.city,
    `COD: ${formatPKR(order.totalPaisa)}`,
    `Order ${order.orderNumber}`,
  ].join("\n");

  const waText = encodeURIComponent(
    `Assalam o Alaikum ${order.customerName}, this is ${store.name}. We are confirming your order ${order.orderNumber} for ${formatPKR(order.totalPaisa)} (cash on delivery) to: ${order.address}, ${order.city}. Reply YES to confirm.`,
  );

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/orders", label: "Orders" }}
        title={order.orderNumber}
        subtitle={
          <>
            Placed <DateCell value={order.createdAt} />
            {order.draftOrderId ? " · created from a draft" : ""}
          </>
        }
        actions={
          <>
            <OrderStatusPill status={order.status} />
            <a href={`/admin/orders/${order.id}/print`} target="_blank" rel="noopener" className="a-btn a-btn-xs">
              Packing slip
            </a>
            <a
              href={`https://wa.me/${waNumber(order.phone)}?text=${waText}`}
              target="_blank"
              rel="noopener"
              className="a-btn a-btn-xs"
            >
              WhatsApp
            </a>
          </>
        }
      />

      {risk.level !== "none" ? (
        <p
          role="status"
          className={`mb-3 rounded border px-2.5 py-2 text-[12px] ${
            risk.level === "high"
              ? "border-[#e8b4b0] bg-[var(--a-danger-bg)] text-[var(--a-danger)]"
              : "border-[#e6cfa0] bg-[var(--a-warn-bg)] text-[var(--a-warn)]"
          }`}
        >
          <strong>{risk.level === "high" ? "High COD risk." : "Watch this one."}</strong> {risk.reason}
        </p>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <Card title="Customer">
            <dl className="grid gap-x-6 gap-y-2 p-3 text-[12.5px] sm:grid-cols-2">
              <div>
                <dt className="a-label">Name</dt>
                <dd className="font-medium">
                  {customer ? (
                    <Link href={`/admin/customers/${customer.id}`} className="text-[var(--a-info)] hover:underline">
                      {order.customerName}
                    </Link>
                  ) : (
                    order.customerName
                  )}
                </dd>
              </div>
              <div>
                <dt className="a-label">Phone</dt>
                <dd>
                  <a href={`tel:${order.phone}`} className="text-[var(--a-info)] hover:underline">
                    {displayPkPhone(order.phone)}
                  </a>
                  {order.altPhone ? (
                    <>
                      {" / "}
                      <a href={`tel:${order.altPhone}`} className="text-[var(--a-info)] hover:underline">
                        {displayPkPhone(order.altPhone)}
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="a-label">Address</dt>
                <dd>
                  {order.address}, {order.city}
                </dd>
              </div>
              {customer ? (
                <div className="sm:col-span-2 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-[var(--a-soft)]">
                  <span>{customer.ordersCount} orders</span>
                  <span>Lifetime {formatPKR(customer.totalSpentPaisa)}</span>
                  <span>Delivery success {rate === null ? "—" : `${rate}%`}</span>
                  <span>
                    {customer.cancelledCount} cancelled · {customer.returnedCount} returned
                  </span>
                  {customer.tags.length ? (
                    <span className="flex gap-1">
                      {customer.tags.map((t) => (
                        <span key={t} className="a-tag">
                          {t}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {order.notes ? (
                <div className="sm:col-span-2">
                  <dt className="a-label">Customer notes</dt>
                  <dd>{order.notes}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {editable ? (
            <OrderEditor
              orderId={order.id}
              items={order.items.map((i) => ({
                id: i.id,
                variantId: i.variantId,
                productName: i.productName,
                variantLabel: i.variantLabel,
                sku: i.sku,
                productSlug: i.productSlug,
                unitPriceRupees: i.unitPricePaisa / 100,
                quantity: i.quantity,
              }))}
              deliveryRupees={order.deliveryPaisa / 100}
              discountRupees={order.discountPaisa / 100}
              discountReason={order.discountCode ?? ""}
            />
          ) : (
            <Card title="Items">
              <div className="a-scroll">
                <table className="a-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th className="a-num">Qty</th>
                      <th className="a-num">Unit</th>
                      <th className="a-num">Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((it) => (
                      <tr key={it.id}>
                        <td>
                          {it.productName} <span className="text-[var(--a-soft)]">{it.variantLabel}</span>
                        </td>
                        <td className="a-mono text-[var(--a-soft)]">{it.sku}</td>
                        <td className="a-num">{it.quantity}</td>
                        <td className="a-num">{formatPKR(it.unitPricePaisa)}</td>
                        <td className="a-num">{formatPKR(it.lineTotalPaisa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="space-y-1 border-t border-[var(--a-border)] p-3 text-[12.5px]">
                <div className="flex justify-between">
                  <dt className="text-[var(--a-soft)]">Subtotal</dt>
                  <dd>
                    <Money paisa={order.subtotalPaisa} />
                  </dd>
                </div>
                {order.discountPaisa > 0 ? (
                  <div className="flex justify-between text-[var(--a-ok)]">
                    <dt>Discount {order.discountCode ? `(${order.discountCode})` : ""}</dt>
                    <dd className="a-num">-{formatPKR(order.discountPaisa)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-[var(--a-soft)]">Delivery</dt>
                  <dd>
                    <Money paisa={order.deliveryPaisa} />
                  </dd>
                </div>
                <div className="flex justify-between border-t border-[var(--a-border)] pt-1 font-semibold">
                  <dt>Collect on delivery</dt>
                  <dd>
                    <Money paisa={order.totalPaisa} bold />
                  </dd>
                </div>
              </dl>
              {["shipped", "delivered"].includes(order.status) && can(ctx.user.role, "orders:edit") ? (
                <p className="border-t border-[var(--a-border)] px-3 py-2 text-[11.5px] text-[var(--a-soft)]">
                  This order has shipped, so its lines are locked. Cancel it to restore stock instead.
                </p>
              ) : null}
            </Card>
          )}

          <OrderTimeline
            orderId={order.id}
            events={order.events.map((e) => ({
              id: e.id,
              type: e.type,
              fromStatus: e.fromStatus,
              toStatus: e.toStatus,
              message: e.message,
              note: e.note,
              userName: e.userName,
              createdAt: e.createdAt.toISOString(),
            }))}
            canWrite={can(ctx.user.role, "orders:write")}
          />

          {previous.length ? (
            <Card title={`Previous orders from ${displayPkPhone(order.phone)}`}>
              <div className="a-scroll">
                <table className="a-table">
                  <tbody>
                    {previous.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/admin/orders/${p.id}`} prefetch={false} className="text-[var(--a-info)] hover:underline">
                            {p.orderNumber}
                          </Link>
                        </td>
                        <td>
                          <OrderStatusPill status={p.status} />
                        </td>
                        <td className="a-num">{formatPKR(p.totalPaisa)}</td>
                        <td>
                          <DateCell value={p.createdAt} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>

        <OrderSidebar
          orderId={order.id}
          status={order.status}
          statusLabel={ORDER_STATUS_LABEL[order.status]}
          internalNote={order.internalNote ?? ""}
          tags={order.tags}
          addressText={addressText}
          canWrite={can(ctx.user.role, "orders:write")}
          canDelete={can(ctx.user.role, "orders:edit")}
        />
      </div>
    </>
  );
}
