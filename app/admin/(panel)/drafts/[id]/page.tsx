import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/admin/session";
import { getDraft } from "@/lib/admin/drafts";
import { getDeliverySettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { DraftOrderForm, type DraftFormValues } from "@/components/admin/DraftOrderForm";

export const metadata = { title: "Draft order" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireView("drafts:read");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const draft = await getDraft(id);
  if (!draft) notFound();
  void (await getDeliverySettings());

  const initial: DraftFormValues = {
    id: draft.id,
    customerId: draft.customerId ?? "",
    customerName: draft.customerName,
    phone: draft.phone,
    altPhone: draft.altPhone ?? "",
    city: draft.city,
    address: draft.address,
    notes: draft.notes ?? "",
    internalNote: draft.internalNote ?? "",
    lines: draft.items.map((i) => ({
      variantId: i.variantId,
      productName: i.productName,
      variantLabel: i.variantLabel,
      sku: i.sku,
      productSlug: i.productSlug,
      unitPriceRupees: i.unitPricePaisa / 100,
      quantity: i.quantity,
    })),
    deliveryRupees: String(draft.deliveryPaisa / 100),
    discountRupees: String(draft.discountPaisa / 100),
    discountReason: draft.discountReason ?? "",
    converted: draft.status !== "open",
  };

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/drafts", label: "Draft orders" }}
        title={draft.customerName || "Draft order"}
        subtitle={draft.status === "open" ? "Open draft — stock is not reserved" : `Draft ${draft.status}`}
        actions={
          draft.convertedOrderId ? (
            <Link href={`/admin/orders/${draft.convertedOrderId}`} className="a-btn a-btn-xs">
              View the order
            </Link>
          ) : null
        }
      />
      <DraftOrderForm initial={initial} />
    </>
  );
}
