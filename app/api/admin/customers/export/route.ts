import { NextResponse } from "next/server";
import { requirePermission, AdminForbiddenError, AdminUnauthorizedError } from "@/lib/admin/session";
import { customersFilterSchema } from "@/lib/validation/admin";
import { deliveryRate, listCustomersForExport } from "@/lib/admin/customers";
import { paisaToDecimal } from "@/lib/money";
import { toCsv } from "@/lib/csv";
import { audit } from "@/lib/admin/audit";

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await requirePermission("customers:read");
  } catch (err) {
    const status = err instanceof AdminForbiddenError ? 403 : err instanceof AdminUnauthorizedError ? 401 : 500;
    return NextResponse.json({ error: "Not allowed" }, { status });
  }

  const url = new URL(req.url);
  const filter =
    customersFilterSchema.safeParse(Object.fromEntries(url.searchParams)).data ?? customersFilterSchema.parse({});
  const rows = await listCustomersForExport(filter);

  const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeZone: "Asia/Karachi" });

  const csv = toCsv(
    [
      "phone",
      "name",
      "email",
      "city",
      "tags",
      "orders",
      "delivered",
      "cancelled",
      "returned",
      "delivery_rate_pct",
      "lifetime_spend_pkr",
      "average_order_pkr",
      "first_order",
      "last_order",
      "internal_note",
    ],
    rows.map((c) => [
      c.phone,
      c.name,
      c.email ?? "",
      c.city,
      c.tags.join("|"),
      c.ordersCount,
      c.deliveredCount,
      c.cancelledCount,
      c.returnedCount,
      deliveryRate(c) ?? "",
      paisaToDecimal(c.totalSpentPaisa),
      paisaToDecimal(c.avgOrderPaisa),
      c.firstOrderAt ? fmt.format(c.firstOrderAt) : "",
      c.lastOrderAt ? fmt.format(c.lastOrderAt) : "",
      c.internalNote,
    ]),
  );

  await audit(ctx, {
    action: "customer.export",
    entityType: "customer",
    entityLabel: `${rows.length} customers`,
    after: { count: rows.length, filter: url.search || "(none)" },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="markorganics-customers-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
