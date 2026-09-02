import { listOrdersByIds } from "@/lib/queries/orders";
import { getStoreSettings } from "@/lib/settings";
import { requireView } from "@/lib/admin/session";
import { PackingSlip } from "@/components/admin/PackingSlip";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Packing slips" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Batch slips for a bulk selection on the orders list. */
export default async function PrintOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requireView("orders:read");
  const { ids } = await searchParams;
  const list = (ids ?? "").split(",").map((s) => s.trim()).filter((s) => UUID.test(s)).slice(0, 100);

  const [orders, store] = await Promise.all([listOrdersByIds(list), getStoreSettings()]);

  if (orders.length === 0) {
    return <p className="p-4 text-[12.5px]">No orders were selected. Go back and pick some orders first.</p>;
  }

  return (
    <>
      <PrintButton count={orders.length} />
      {orders.map((order) => (
        <PackingSlip key={order.id} order={order} store={store} />
      ))}
    </>
  );
}
