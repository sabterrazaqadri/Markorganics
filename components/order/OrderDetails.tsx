import { formatPKR } from "@/lib/money";
import { displayPkPhone } from "@/lib/phone";
import type { OrderWithItems } from "@/lib/queries/orders";
import { OrderTimeline, StatusBadge } from "./OrderStatus";

export function formatPkDate(d: Date): string {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  }).format(d);
}

/** Lines from one bundle sit together under the bundle's name. */
function groupLines(items: OrderWithItems["items"]) {
  const groups: { key: string; bundleName: string | null; items: OrderWithItems["items"] }[] = [];
  for (const item of items) {
    const key = item.bundleSku ? `bundle:${item.bundleSku}` : `line:${item.id}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(item);
    else groups.push({ key, bundleName: item.bundleName ?? null, items: [item] });
  }
  return groups;
}

export function OrderDetails({ order }: { order: OrderWithItems }) {
  const groups = groupLines(order.items);
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="card p-5" aria-labelledby="status-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="status-title" className="text-lg">
              Status
            </h2>
            <StatusBadge status={order.status} />
          </div>
          <OrderTimeline status={order.status} />
        </section>

        <section className="card" aria-labelledby="items-title">
          <h2 id="items-title" className="border-b border-rule px-5 py-4 text-lg">
            Items
          </h2>
          <ul className="divide-y divide-rule">
            {groups.map((g) =>
              g.bundleName ? (
                <li key={g.key} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium">
                      {g.bundleName} <span className="rounded bg-band-care/10 px-1.5 py-0.5 text-xs text-band-care">Kit</span>
                    </p>
                    <p className="tabular">{formatPKR(g.items.reduce((n, i) => n + i.lineTotalPaisa, 0))}</p>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-ink-soft">
                    {g.items.map((item) => (
                      <li key={item.id}>
                        {item.productName} {item.variantLabel} &times; {item.quantity}
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                g.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-ink-soft">
                        {item.variantLabel} &times; {item.quantity} at {formatPKR(item.unitPricePaisa)}
                      </p>
                    </div>
                    <p className="tabular">{formatPKR(item.lineTotalPaisa)}</p>
                  </li>
                ))
              ),
            )}
          </ul>
          <dl className="space-y-1.5 border-t border-rule px-5 py-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd className="tabular">{formatPKR(order.subtotalPaisa)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Delivery</dt>
              <dd className="tabular">{order.deliveryPaisa === 0 ? "Free" : formatPKR(order.deliveryPaisa)}</dd>
            </div>
            <div className="flex justify-between border-t border-rule pt-2 text-base font-semibold">
              <dt>Pay on delivery</dt>
              <dd className="tabular">{formatPKR(order.totalPaisa)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <aside className="card h-fit p-5 text-sm" aria-labelledby="delivery-title">
        <h2 id="delivery-title" className="text-lg">
          Delivery details
        </h2>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="text-ink-soft">Order number</dt>
            <dd className="font-medium">{order.orderNumber}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Placed</dt>
            <dd>{formatPkDate(order.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Name</dt>
            <dd>{order.customerName}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Phone</dt>
            <dd>
              {displayPkPhone(order.phone)}
              {order.altPhone ? <span className="text-ink-soft"> / {displayPkPhone(order.altPhone)}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-ink-soft">Address</dt>
            <dd>
              {order.address}, {order.city}
            </dd>
          </div>
          {order.notes ? (
            <div>
              <dt className="text-ink-soft">Notes</dt>
              <dd>{order.notes}</dd>
            </div>
          ) : null}
        </dl>
      </aside>
    </div>
  );
}
