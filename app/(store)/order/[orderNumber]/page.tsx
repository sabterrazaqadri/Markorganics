import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByNumber } from "@/lib/queries/orders";
import { normalizeOrderNumber } from "@/lib/order-number";
import { OrderDetails } from "@/components/order/OrderDetails";
import { WHATSAPP_NUMBER } from "@/config/commerce";
import { getStoreSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export default async function OrderPage({ params }: Props) {
  const { orderNumber } = await params;
  const { orderNumberPrefix } = await getStoreSettings();
  const normalized = normalizeOrderNumber(orderNumber, orderNumberPrefix);
  if (!normalized) notFound();
  const order = await getOrderByNumber(normalized);
  if (!order) notFound();

  const justPlaced = Date.now() - order.createdAt.getTime() < 5 * 60 * 1000 && order.status === "pending";
  const waText = encodeURIComponent(`Hello, I have a question about order ${order.orderNumber}.`);

  return (
    <div className="container-x py-8 md:py-12">
      <p className="text-sm font-medium text-band-care">{justPlaced ? "Order placed" : "Order"}</p>
      <h1 className="mt-1 text-3xl sm:text-4xl">{order.orderNumber}</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        {justPlaced
          ? "We will call your number to confirm before dispatch. Keep this order number for tracking."
          : "Here is the latest on your order."}
      </p>
      <OrderDetails order={order} />
      <div className="mt-8 flex flex-wrap gap-3">
        <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`} className="btn btn-secondary" rel="noopener">
          Ask on WhatsApp
        </a>
        <Link href="/products" className="btn btn-primary">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
