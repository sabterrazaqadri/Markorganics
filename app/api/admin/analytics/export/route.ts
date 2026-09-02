import { NextResponse } from "next/server";
import { requirePermission, AdminForbiddenError, AdminUnauthorizedError } from "@/lib/admin/session";
import { getAnalytics } from "@/lib/admin/analytics";
import { analyticsRangeSchema } from "@/lib/validation/admin";
import { paisaToDecimal } from "@/lib/money";
import { toCsv } from "@/lib/csv";

/** Every report on the analytics page, stacked into one CSV. */
export async function GET(req: Request) {
  try {
    await requirePermission("analytics:read");
  } catch (err) {
    const status = err instanceof AdminForbiddenError ? 403 : err instanceof AdminUnauthorizedError ? 401 : 500;
    return NextResponse.json({ error: "Not allowed" }, { status });
  }

  const url = new URL(req.url);
  const range = analyticsRangeSchema.safeParse(Object.fromEntries(url.searchParams)).data ?? analyticsRangeSchema.parse({});
  const report = await getAnalytics(range);

  const rows: unknown[][] = [];
  const section = (name: string, headers: string[]) => {
    rows.push([]);
    rows.push([name]);
    rows.push(headers);
  };

  rows.push(["metric", "value", "previous", "change_pct"]);
  rows.push(["revenue_pkr", paisaToDecimal(report.revenue.value), paisaToDecimal(report.revenue.previous), report.revenue.changePct ?? ""]);
  rows.push(["orders", report.orders.value, report.orders.previous, report.orders.changePct ?? ""]);
  rows.push(["average_order_pkr", paisaToDecimal(report.aov.value), paisaToDecimal(report.aov.previous), report.aov.changePct ?? ""]);
  rows.push(["delivery_success_pct", report.deliveredRate.value, report.deliveredRate.previous, report.deliveredRate.changePct ?? ""]);
  rows.push(["cancellation_pct", report.cancelRate.value, report.cancelRate.previous, report.cancelRate.changePct ?? ""]);
  rows.push(["return_pct", report.returnRate.value, report.returnRate.previous, report.returnRate.changePct ?? ""]);
  rows.push(["new_customers", report.newCustomers.value, report.newCustomers.previous, report.newCustomers.changePct ?? ""]);
  rows.push(["returning_customers", report.returningCustomers.value, report.returningCustomers.previous, report.returningCustomers.changePct ?? ""]);
  rows.push(["repeat_purchase_pct", report.repeatRatePct, "", ""]);

  section("Sales over time", ["day", "orders", "revenue_pkr"]);
  for (const p of report.series) rows.push([p.day, p.orders, paisaToDecimal(p.revenuePaisa)]);

  section("Top products", ["product", "slug", "units", "revenue_pkr"]);
  for (const p of report.topProducts) rows.push([p.name, p.slug, p.units, paisaToDecimal(p.revenuePaisa)]);

  section("Top variants", ["product", "variant", "sku", "units", "revenue_pkr"]);
  for (const v of report.topVariants) rows.push([v.name, v.label, v.sku, v.units, paisaToDecimal(v.revenuePaisa)]);

  section("By city", ["city", "orders", "revenue_pkr", "delivered_pct"]);
  for (const c of report.byCity) rows.push([c.city, c.orders, paisaToDecimal(c.revenuePaisa), c.deliveredPct ?? ""]);

  section("Status funnel", ["status", "orders"]);
  for (const f of report.funnel) rows.push([f.status, f.n]);

  section("Cancellation and return reasons", ["reason", "orders"]);
  for (const r of report.cancelReasons) rows.push([r.reason, r.n]);

  section("Discounts", ["title", "code", "uses", "discounted_pkr", "revenue_pkr"]);
  for (const d of report.discounts) {
    rows.push([d.title, d.code ?? "automatic", d.uses, paisaToDecimal(d.discountedPaisa), paisaToDecimal(d.revenuePaisa)]);
  }

  const csv = toCsv([`MARKORGANICS analytics — ${report.period.label}`, "", "", ""], rows);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="markorganics-analytics-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
