import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/admin/session";
import { getVariantHistory, getVariantWithProduct, REASON_LABEL } from "@/lib/admin/inventory";
import { Card, DateCell, PageHeader } from "@/components/admin/ui";
import { formatPKR } from "@/lib/money";

export const metadata = { title: "Stock history" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VariantHistoryPage({ params }: { params: Promise<{ variantId: string }> }) {
  await requireView("inventory:read");
  const { variantId } = await params;
  if (!UUID.test(variantId)) notFound();

  const row = await getVariantWithProduct(variantId);
  if (!row) notFound();
  const history = await getVariantHistory(variantId);

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/inventory", label: "Inventory" }}
        title={`${row.productName} · ${row.variant.label}`}
        subtitle={
          <>
            <span className="a-mono">{row.variant.sku}</span> · {formatPKR(row.variant.pricePaisa)} · {row.variant.stock} available
          </>
        }
        actions={
          <Link href={`/admin/products/${row.productId}`} className="a-btn a-btn-xs">
            Edit product
          </Link>
        }
      />

      <Card title="Stock history">
        {history.length === 0 ? (
          <p className="p-3 text-[12px] text-[var(--a-soft)]">
            No adjustments recorded yet. Every change from here on is logged.
          </p>
        ) : (
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Reason</th>
                  <th className="a-num">Change</th>
                  <th className="a-num">Resulting stock</th>
                  <th>Note</th>
                  <th>Who</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <DateCell value={h.createdAt} />
                    </td>
                    <td>
                      <span className="a-badge a-badge-neutral">{REASON_LABEL[h.reason]}</span>
                    </td>
                    <td className={`a-num font-semibold ${h.delta < 0 ? "text-[var(--a-danger)]" : "text-[var(--a-ok)]"}`}>
                      {h.delta > 0 ? `+${h.delta}` : h.delta}
                    </td>
                    <td className="a-num">{h.resultingStock}</td>
                    <td className="max-w-[260px] truncate">{h.note || "—"}</td>
                    <td className="text-[var(--a-soft)]">{h.userName ?? h.userEmail ?? "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
