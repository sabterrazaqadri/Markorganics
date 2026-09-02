import { requireView } from "@/lib/admin/session";
import { PageHeader } from "@/components/admin/ui";
import { DiscountForm, EMPTY_DISCOUNT } from "@/components/admin/DiscountForm";

export const metadata = { title: "New discount" };
export const dynamic = "force-dynamic";

export default async function NewDiscountPage() {
  await requireView("discounts:write");
  return (
    <>
      <PageHeader breadcrumb={{ href: "/admin/discounts", label: "Discounts" }} title="New discount" />
      <DiscountForm initial={EMPTY_DISCOUNT} />
    </>
  );
}
