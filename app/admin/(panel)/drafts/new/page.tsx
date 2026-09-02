import { requireView } from "@/lib/admin/session";
import { getDeliverySettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { DraftOrderForm, EMPTY_DRAFT } from "@/components/admin/DraftOrderForm";

export const metadata = { title: "New draft order" };
export const dynamic = "force-dynamic";

export default async function NewDraftPage() {
  await requireView("drafts:write");
  const delivery = await getDeliverySettings();

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/drafts", label: "Draft orders" }}
        title="New draft order"
        subtitle="For phone orders, wholesale and replacements. Stock is taken only when you convert."
      />
      <DraftOrderForm
        initial={{ ...EMPTY_DRAFT, deliveryRupees: String(delivery.flatRatePaisa / 100) }}
      />
    </>
  );
}
