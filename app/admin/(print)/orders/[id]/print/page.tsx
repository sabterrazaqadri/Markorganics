import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/queries/orders";
import { getStoreSettings } from "@/lib/settings";
import { requireView } from "@/lib/admin/session";
import { PackingSlip } from "@/components/admin/PackingSlip";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Packing slip" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireView("orders:read");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [order, store] = await Promise.all([getOrderById(id), getStoreSettings()]);
  if (!order) notFound();

  return (
    <>
      <PrintButton count={1} />
      <PackingSlip order={order} store={store} />
    </>
  );
}
