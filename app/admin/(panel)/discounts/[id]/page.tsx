import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { discountRedemptions, discounts, discountTargets, orders } from "@/lib/db/schema";
import { requireView } from "@/lib/admin/session";
import { formatPKR } from "@/lib/money";
import { displayPkPhone } from "@/lib/phone";
import { Card, DateCell, PageHeader, StatTile } from "@/components/admin/ui";
import { DiscountForm, type DiscountFormValues } from "@/components/admin/DiscountForm";

export const metadata = { title: "Edit discount" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (d: Date | null) => (d ? new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10) : "");

export default async function EditDiscountPage({ params }: { params: Promise<{ id: string }> }) {
  await requireView("discounts:write");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const discount = await db.query.discounts.findFirst({ where: eq(discounts.id, id) });
  if (!discount) notFound();

  const [targets, redemptions] = await Promise.all([
    db.select().from(discountTargets).where(eq(discountTargets.discountId, id)),
    db
      .select({
        id: discountRedemptions.id,
        phone: discountRedemptions.phone,
        amountPaisa: discountRedemptions.amountPaisa,
        orderTotalPaisa: discountRedemptions.orderTotalPaisa,
        createdAt: discountRedemptions.createdAt,
        orderId: discountRedemptions.orderId,
        orderNumber: orders.orderNumber,
      })
      .from(discountRedemptions)
      .leftJoin(orders, eq(orders.id, discountRedemptions.orderId))
      .where(eq(discountRedemptions.discountId, id))
      .orderBy(desc(discountRedemptions.createdAt))
      .limit(100),
  ]);

  const pick = (role: string, key: "productId" | "collectionId") =>
    targets.filter((t) => t.role === role && t[key]).map((t) => t[key] as string);

  const initial: DiscountFormValues = {
    id: discount.id,
    title: discount.title,
    method: discount.method,
    code: discount.code ?? "",
    type: discount.type,
    percentage: String(discount.value / 100),
    amountRupees: String(discount.value / 100),
    appliesTo: discount.appliesTo,
    targetProductIds: pick("applies", "productId"),
    targetCollectionIds: pick("applies", "collectionId"),
    buyProductIds: pick("buy", "productId"),
    getProductIds: pick("get", "productId"),
    buyQuantity: String(discount.buyQuantity),
    getQuantity: String(discount.getQuantity),
    getDiscountPercent: String(discount.getDiscountBp / 100),
    minSubtotalRupees: String(discount.minSubtotalPaisa / 100),
    minQuantity: String(discount.minQuantity),
    firstTimeOnly: discount.firstTimeOnly,
    segmentId: discount.segmentId ?? "",
    usageLimit: discount.usageLimit ? String(discount.usageLimit) : "",
    oncePerCustomer: discount.oncePerCustomer,
    startsAt: day(discount.startsAt),
    endsAt: day(discount.endsAt),
    isEnabled: discount.isEnabled,
  };

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/discounts", label: "Discounts" }}
        title={discount.title}
        subtitle={discount.code ? `Code ${discount.code}` : "Automatic discount"}
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Times used" value={String(discount.usageCount)} sub={discount.usageLimit ? `of ${discount.usageLimit}` : "no limit"} />
        <StatTile label="Given away" value={formatPKR(discount.discountedPaisa)} />
        <StatTile label="Revenue attributed" value={formatPKR(discount.revenuePaisa)} />
        <StatTile
          label="Average order"
          value={discount.usageCount ? formatPKR(Math.round(discount.revenuePaisa / discount.usageCount)) : "—"}
        />
      </div>

      <DiscountForm initial={initial} />

      {redemptions.length ? (
        <div className="mt-3">
          <Card title={`Redemptions (${redemptions.length})`}>
            <div className="a-scroll">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Phone</th>
                    <th className="a-num">Discount</th>
                    <th className="a-num">Order total</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.orderId ? (
                          <Link href={`/admin/orders/${r.orderId}`} prefetch={false} className="text-[var(--a-info)] hover:underline">
                            {r.orderNumber ?? "Order"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{r.phone ? displayPkPhone(r.phone) : "—"}</td>
                      <td className="a-num">{formatPKR(r.amountPaisa)}</td>
                      <td className="a-num">{formatPKR(r.orderTotalPaisa)}</td>
                      <td>
                        <DateCell value={r.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
