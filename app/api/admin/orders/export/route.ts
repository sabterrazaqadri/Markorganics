import { NextResponse } from "next/server";
import { listOrdersByIds, listOrdersForExport } from "@/lib/queries/orders";
import { ordersFilterSchema } from "@/lib/validation/admin";
import { paisaToDecimal } from "@/lib/money";
import { toCsv } from "@/lib/csv";
import { requirePermission, AdminForbiddenError, AdminUnauthorizedError } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await requirePermission("orders:export");
  } catch (err) {
    const status = err instanceof AdminForbiddenError ? 403 : err instanceof AdminUnauthorizedError ? 401 : 500;
    return NextResponse.json({ error: "Not allowed" }, { status });
  }

  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");

  // A bulk selection wins over the filter; otherwise export what is on screen.
  const orders = idsParam
    ? await listOrdersByIds(idsParam.split(",").map((s) => s.trim()).filter((s) => UUID.test(s)).slice(0, 500))
    : await listOrdersForExport(
        ordersFilterSchema.safeParse(Object.fromEntries(url.searchParams)).data ?? ordersFilterSchema.parse({}),
      );

  const fmt = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  });

  const rows = orders.map((o) => [
    o.orderNumber,
    fmt.format(o.createdAt),
    o.status,
    o.customerName,
    o.phone,
    o.altPhone ?? "",
    o.city,
    o.address,
    o.tags.join("|"),
    o.notes ?? "",
    o.items.map((i) => `${i.quantity} x ${i.productName} ${i.variantLabel}`).join("; "),
    o.itemCount || o.items.reduce((n, i) => n + i.quantity, 0),
    paisaToDecimal(o.subtotalPaisa),
    paisaToDecimal(o.discountPaisa),
    o.discountCode ?? "",
    paisaToDecimal(o.deliveryPaisa),
    paisaToDecimal(o.totalPaisa),
    o.internalNote ?? "",
  ]);

  const csv = toCsv(
    [
      "order_number",
      "placed_at_pkt",
      "status",
      "customer_name",
      "phone",
      "alt_phone",
      "city",
      "address",
      "tags",
      "customer_notes",
      "items",
      "item_count",
      "subtotal_pkr",
      "discount_pkr",
      "discount_code",
      "delivery_pkr",
      "total_pkr",
      "internal_note",
    ],
    rows,
  );

  await audit(ctx, {
    action: "order.export",
    entityType: "order",
    entityLabel: `${orders.length} orders`,
    after: { count: orders.length, filter: url.search || "(none)" },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="markorganic-orders-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
