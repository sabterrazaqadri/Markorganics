import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { formatPKR } from "@/lib/money";
import { getIntegrationSettings } from "@/lib/settings";
import { codSummary, listRemittances } from "@/lib/courier/cod";
import { outstandingCod } from "@/lib/courier/shipments";
import { COURIER_ADAPTERS, courierName } from "@/lib/courier";
import { Card, DateCell, EmptyState, Money, StatTile } from "@/components/admin/ui";
import { RemittanceForm } from "@/components/admin/RemittanceForm";

export const metadata = { title: "COD reconciliation" };
export const dynamic = "force-dynamic";

/**
 * Where COD money quietly goes missing.
 *
 * The discrepancy list is the first thing on the page, ahead of the totals and
 * the entry form, because it is the only part that costs money to ignore.
 */
export default async function CodPage() {
  const ctx = await requireView("integrations:read");
  const settings = await getIntegrationSettings();

  const [outstanding, summary, remittances] = await Promise.all([
    outstandingCod(undefined, settings.codRemittanceDays),
    codSummary(),
    listRemittances(),
  ]);

  const totalOutstanding = outstanding.reduce((n, s) => n + s.shortfallPaisa, 0);
  const collected = summary.reduce((n, s) => n + s.collectedPaisa, 0);
  const remitted = summary.reduce((n, s) => n + s.remittedPaisa, 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <StatTile label="Collected on delivery" value={formatPKR(collected)} sub="Across all delivered shipments" />
        <StatTile label="Remitted by couriers" value={formatPKR(remitted)} sub="Recorded on this page" tone="ok" />
        <StatTile
          label="Unpaid past the window"
          value={formatPKR(totalOutstanding)}
          sub={`Delivered over ${settings.codRemittanceDays} days ago`}
          tone={totalOutstanding > 0 ? "danger" : "ok"}
        />
      </div>

      <Card
        title={`Discrepancies (${outstanding.length})`}
        actions={
          <Link href="/admin/integrations" className="a-btn-link">
            Change the window
          </Link>
        }
      >
        {outstanding.length === 0 ? (
          <EmptyState title="Every delivered parcel has been paid for">
            Nothing delivered more than {settings.codRemittanceDays} days ago is still unpaid. This is the state you
            want this page in.
          </EmptyState>
        ) : (
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Tracking</th>
                  <th>Courier</th>
                  <th>Delivered</th>
                  <th className="a-num">Days</th>
                  <th className="a-num">Collected</th>
                  <th className="a-num">Paid</th>
                  <th className="a-num">Short by</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/orders/${row.orderId}`} prefetch={false} className="text-[var(--a-info)] hover:underline">
                        {row.orderNumber}
                      </Link>
                      <div className="text-[11px] text-[var(--a-soft)]">
                        {row.customerName} · {row.city}
                      </div>
                    </td>
                    <td className="a-mono text-[11.5px]">{row.trackingNumber}</td>
                    <td>{courierName(row.provider)}</td>
                    <td>
                      <DateCell value={row.deliveredAt} />
                    </td>
                    <td className="a-num">{row.daysSinceDelivery}</td>
                    <td className="a-num">{formatPKR(row.codAmountPaisa)}</td>
                    <td className="a-num">{formatPKR(row.remittedPaisa)}</td>
                    <td className="a-num font-semibold text-[var(--a-danger)]">{formatPKR(row.shortfallPaisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RemittanceForm
        providers={Object.values(COURIER_ADAPTERS).map((a) => ({ id: a.id, name: a.name }))}
        canWrite={can(ctx.user.role, "integrations:write")}
      />

      <Card title="Per courier">
        <div className="a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>Courier</th>
                <th className="a-num">Delivered</th>
                <th className="a-num">Collected</th>
                <th className="a-num">Remitted</th>
                <th className="a-num">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {summary.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-[var(--a-soft)]">
                    Nothing delivered yet.
                  </td>
                </tr>
              ) : (
                summary.map((row) => (
                  <tr key={row.provider}>
                    <td>{courierName(row.provider)}</td>
                    <td className="a-num">{row.deliveredCount}</td>
                    <td className="a-num">
                      <Money paisa={row.collectedPaisa} />
                    </td>
                    <td className="a-num">
                      <Money paisa={row.remittedPaisa} />
                    </td>
                    <td className={`a-num ${row.outstandingPaisa > 0 ? "font-semibold text-[var(--a-danger)]" : ""}`}>
                      {formatPKR(row.outstandingPaisa)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Payouts recorded">
        {remittances.length === 0 ? (
          <EmptyState title="No payouts recorded yet">
            Record each payment as it lands, with the courier&rsquo;s own line-by-line sheet, and the discrepancy list
            above stays trustworthy.
          </EmptyState>
        ) : (
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Courier</th>
                  <th>Reference</th>
                  <th className="a-num">Received</th>
                  <th className="a-num">Allocated</th>
                  <th className="a-num">Variance</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {remittances.map((row) => {
                  const variance = row.amountPaisa - row.allocatedPaisa;
                  return (
                    <tr key={row.id}>
                      <td>
                        <DateCell value={row.paidOn} />
                      </td>
                      <td>{courierName(row.provider)}</td>
                      <td className="a-mono text-[11.5px]">{row.reference || "—"}</td>
                      <td className="a-num">
                        <Money paisa={row.amountPaisa} />
                      </td>
                      <td className="a-num">
                        <Money paisa={row.allocatedPaisa} />
                      </td>
                      <td className={`a-num ${variance !== 0 ? "font-semibold text-[var(--a-danger)]" : ""}`}>
                        {formatPKR(variance)}
                      </td>
                      <td className="max-w-[220px] truncate text-[11.5px] text-[var(--a-soft)]">{row.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
