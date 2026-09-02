import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { getAnalytics, type Metric } from "@/lib/admin/analytics";
import { analyticsRangeSchema } from "@/lib/validation/admin";
import { formatPKR } from "@/lib/money";
import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import { SeriesChart } from "@/components/admin/SeriesChart";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "custom", label: "Custom" },
] as const;

function Delta({ metric, invert }: { metric: Metric; invert?: boolean }) {
  if (metric.changePct === null) {
    return <span className="text-[11px] text-[var(--a-soft)]">no previous data</span>;
  }
  const up = metric.changePct > 0;
  const good = invert ? !up : up;
  const colour = metric.changePct === 0 ? "text-[var(--a-soft)]" : good ? "text-[var(--a-ok)]" : "text-[var(--a-danger)]";
  return (
    <span className={`text-[11px] ${colour}`}>
      {up ? "▲" : metric.changePct < 0 ? "▼" : "•"} {Math.abs(metric.changePct)}% vs previous period
    </span>
  );
}

function MetricTile({
  label,
  metric,
  format,
  invert,
}: {
  label: string;
  metric: Metric;
  format: (n: number) => string;
  invert?: boolean;
}) {
  return (
    <div className="a-card p-3">
      <p className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--a-soft)]">{label}</p>
      <p className="a-num mt-1 text-[20px] font-semibold leading-none" style={{ textAlign: "left" }}>
        {format(metric.value)}
      </p>
      <p className="mt-1">
        <Delta metric={metric} invert={invert} />
      </p>
      <p className="text-[11px] text-[var(--a-soft)]">was {format(metric.previous)}</p>
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requireView("analytics:read");
  const sp = await searchParams;
  const range = analyticsRangeSchema.safeParse(sp).data ?? analyticsRangeSchema.parse({});
  const report = await getAnalytics(range);

  const qs = (key: string) => {
    const params = new URLSearchParams();
    params.set("range", key);
    if (key === "custom") {
      if (sp.from) params.set("from", sp.from);
      if (sp.to) params.set("to", sp.to);
    }
    return `/admin/analytics?${params.toString()}`;
  };
  const exportHref = `/api/admin/analytics/export?${new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  ).toString()}`;

  const pct = (n: number) => `${n}%`;
  const int = (n: number) => n.toLocaleString("en-PK");

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`${report.period.label} · compared with the ${report.period.days} days before it`}
        actions={
          <a href={exportHref} className="a-btn a-btn-xs" download>
            Export CSV
          </a>
        }
      />

      <nav aria-label="Date range" className="a-tabs mb-3">
        {RANGES.map((r) => (
          <Link key={r.key} href={qs(r.key)} className="a-tab" aria-current={range.range === r.key ? "page" : undefined}>
            {r.label}
          </Link>
        ))}
      </nav>

      {range.range === "custom" ? (
        <form method="get" className="a-card mb-3 flex flex-wrap items-end gap-2 p-2">
          <input type="hidden" name="range" value="custom" />
          <div>
            <label htmlFor="from" className="a-label">
              From
            </label>
            <input id="from" name="from" type="date" className="a-input" defaultValue={sp.from ?? ""} />
          </div>
          <div>
            <label htmlFor="to" className="a-label">
              To
            </label>
            <input id="to" name="to" type="date" className="a-input" defaultValue={sp.to ?? ""} />
          </div>
          <button type="submit" className="a-btn a-btn-primary">
            Apply
          </button>
        </form>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Revenue" metric={report.revenue} format={formatPKR} />
        <MetricTile label="Orders" metric={report.orders} format={int} />
        <MetricTile label="Average order value" metric={report.aov} format={formatPKR} />
        <MetricTile label="Delivery success rate" metric={report.deliveredRate} format={pct} />
        <MetricTile label="Cancellation rate" metric={report.cancelRate} format={pct} invert />
        <MetricTile label="Return rate" metric={report.returnRate} format={pct} invert />
        <MetricTile label="New customers" metric={report.newCustomers} format={int} />
        <MetricTile label="Returning customers" metric={report.returningCustomers} format={int} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <Card title="Sales over time">
          {report.series.length === 0 ? (
            <EmptyState title="No orders in this period">Widen the range, or wait for the first order.</EmptyState>
          ) : (
            <div className="p-3">
              <SeriesChart points={report.series} />
            </div>
          )}
        </Card>

        <Card title="Order status funnel">
          <div className="p-3">
            {report.funnel.length === 0 ? (
              <p className="text-[12px] text-[var(--a-soft)]">Nothing in this period.</p>
            ) : (
              <ul className="space-y-1.5">
                {report.funnel
                  .sort((a, b) => b.n - a.n)
                  .map((f) => {
                    const max = Math.max(...report.funnel.map((x) => x.n));
                    return (
                      <li key={f.status}>
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="capitalize">{f.status}</span>
                          <span className="a-num">{f.n}</span>
                        </div>
                        <div className="mt-0.5 h-2 rounded bg-[var(--a-bg)]">
                          <div
                            className="h-2 rounded bg-[var(--a-accent)]"
                            style={{ width: `${max ? (f.n / max) * 100 : 0}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
            <p className="a-hint mt-2">
              Repeat purchase rate across the whole store: <strong>{report.repeatRatePct}%</strong> of customers have
              ordered more than once.
            </p>
          </div>
        </Card>

        <Card title="Top products by revenue">
          {report.topProducts.length === 0 ? (
            <EmptyState title="No sales yet">Nothing sold in this period.</EmptyState>
          ) : (
            <div className="a-scroll">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="a-num">Units</th>
                    <th className="a-num">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((p) => (
                    <tr key={p.slug}>
                      <td className="max-w-[240px] truncate">{p.name}</td>
                      <td className="a-num">{p.units}</td>
                      <td className="a-num">{formatPKR(p.revenuePaisa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Top variants by units">
          {report.topVariants.length === 0 ? (
            <EmptyState title="No sales yet">Nothing sold in this period.</EmptyState>
          ) : (
            <div className="a-scroll">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Variant</th>
                    <th>SKU</th>
                    <th className="a-num">Units</th>
                    <th className="a-num">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {[...report.topVariants]
                    .sort((a, b) => b.units - a.units)
                    .map((v) => (
                      <tr key={v.sku}>
                        <td className="max-w-[200px] truncate">
                          {v.name} <span className="text-[var(--a-soft)]">{v.label}</span>
                        </td>
                        <td className="a-mono text-[var(--a-soft)]">{v.sku}</td>
                        <td className="a-num">{v.units}</td>
                        <td className="a-num">{formatPKR(v.revenuePaisa)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Orders and revenue by city">
          {report.byCity.length === 0 ? (
            <EmptyState title="No orders yet">This drives courier and stocking decisions once orders arrive.</EmptyState>
          ) : (
            <div className="a-scroll">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>City</th>
                    <th className="a-num">Orders</th>
                    <th className="a-num">Revenue</th>
                    <th className="a-num">Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byCity.map((c) => (
                    <tr key={c.city}>
                      <td className="max-w-[160px] truncate">{c.city}</td>
                      <td className="a-num">{c.orders}</td>
                      <td className="a-num">{formatPKR(c.revenuePaisa)}</td>
                      <td
                        className={`a-num ${c.deliveredPct !== null && c.deliveredPct < 60 ? "text-[var(--a-danger)]" : ""}`}
                      >
                        {c.deliveredPct === null ? "—" : `${c.deliveredPct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Cancellation and return reasons">
          {report.cancelReasons.length === 0 ? (
            <EmptyState title="Nothing cancelled or returned">A good period.</EmptyState>
          ) : (
            <div className="a-scroll">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Reason</th>
                    <th className="a-num">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {report.cancelReasons.map((r) => (
                    <tr key={r.reason}>
                      <td className="max-w-[320px] truncate">{r.reason}</td>
                      <td className="a-num">{r.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Discount performance" className="xl:col-span-2">
          {report.discounts.length === 0 ? (
            <EmptyState title="No discounts redeemed">Nothing was redeemed in this period.</EmptyState>
          ) : (
            <div className="a-scroll">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Discount</th>
                    <th>Code</th>
                    <th className="a-num">Uses</th>
                    <th className="a-num">Given away</th>
                    <th className="a-num">Revenue</th>
                    <th className="a-num">Cost of sale</th>
                  </tr>
                </thead>
                <tbody>
                  {report.discounts.map((d) => (
                    <tr key={`${d.title}-${d.code ?? ""}`}>
                      <td>{d.title}</td>
                      <td className="a-mono">{d.code ?? "automatic"}</td>
                      <td className="a-num">{d.uses}</td>
                      <td className="a-num">{formatPKR(d.discountedPaisa)}</td>
                      <td className="a-num">{formatPKR(d.revenuePaisa)}</td>
                      <td className="a-num">
                        {d.revenuePaisa ? `${Math.round((d.discountedPaisa / d.revenuePaisa) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <p className="a-hint mt-3">
        Aggregates are cached for five minutes and recomputed whenever an order changes.
      </p>
    </>
  );
}
