import { formatPKR } from "@/lib/money";
import { displayPkPhone } from "@/lib/phone";
import { Barcode } from "./Barcode";
import { formatPkDateTime } from "./ui";
import type { OrderWithItems } from "@/lib/queries/orders";
import type { StoreSettings } from "@/lib/settings";

export function PackingSlip({ order, store }: { order: OrderWithItems; store: StoreSettings }) {
  return (
    <article className="p-slip">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-bold tracking-tight">{store.name}</p>
          {store.address ? <p className="text-[10.5px]">{store.address}</p> : null}
          <p className="text-[10.5px]">
            {store.contactPhone ? `Ph ${store.contactPhone}` : ""}
            {store.contactEmail ? ` · ${store.contactEmail}` : ""}
          </p>
        </div>
        <div className="text-right">
          <Barcode value={order.orderNumber} height={38} />
          <p className="mt-0.5 text-[13px] font-bold tracking-wide">{order.orderNumber}</p>
          <p className="text-[10px]">{formatPkDateTime(order.createdAt)}</p>
        </div>
      </header>

      <div className="p-rule mt-2 pt-2">
        <p className="text-[10px] font-bold uppercase tracking-wide">Deliver to</p>
        <p className="text-[14px] font-bold">{order.customerName}</p>
        <p className="text-[12.5px] leading-snug">{order.address}</p>
        <p className="text-[12.5px] font-semibold">{order.city}</p>
        <p className="text-[13px] font-bold">
          {displayPkPhone(order.phone)}
          {order.altPhone ? ` / ${displayPkPhone(order.altPhone)}` : ""}
        </p>
      </div>

      <table className="p-table mt-3">
        <thead>
          <tr>
            <th>Item</th>
            <th className="p-num">Qty</th>
            <th className="p-num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.productName} {item.variantLabel}
                <br />
                <span className="text-[10px]">{item.sku}</span>
              </td>
              <td className="p-num">{item.quantity}</td>
              <td className="p-num">{formatPKR(item.lineTotalPaisa)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="p-num pt-1.5">
              Subtotal
            </td>
            <td className="p-num pt-1.5">{formatPKR(order.subtotalPaisa)}</td>
          </tr>
          {order.discountPaisa > 0 ? (
            <tr>
              <td colSpan={2} className="p-num">
                Discount {order.discountCode ? `(${order.discountCode})` : ""}
              </td>
              <td className="p-num">-{formatPKR(order.discountPaisa)}</td>
            </tr>
          ) : null}
          <tr>
            <td colSpan={2} className="p-num">
              Delivery
            </td>
            <td className="p-num">{formatPKR(order.deliveryPaisa)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="p-cod mt-3">
        <span className="text-[10px] font-bold uppercase tracking-wide">Cash to collect on delivery</span>
        <strong>{formatPKR(order.totalPaisa)}</strong>
      </div>

      {order.notes ? (
        <p className="mt-2 text-[11px]">
          <strong>Customer note:</strong> {order.notes}
        </p>
      ) : null}

      <footer className="p-rule mt-3 pt-2 text-[9.5px] leading-snug">
        <p>
          Please check the parcel in front of the rider. Damaged, leaking or wrong items are replaced free within 7 days
          — message {store.contactPhone || store.contactEmail} with this order number.
        </p>
      </footer>
    </article>
  );
}
