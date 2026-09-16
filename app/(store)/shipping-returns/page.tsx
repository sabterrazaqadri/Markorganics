import type { Metadata } from "next";
import { DELIVERY_WINDOW } from "@/config/commerce";
import { formatPKR } from "@/lib/money";
import { getDeliverySettings } from "@/lib/settings";
import { PageBody, pageMetadata } from "@/components/content/PageBody";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("shipping-returns", {
    title: "Shipping and returns",
    description: "Delivery charges, delivery times and the return policy for MARKORGANIC orders.",
  });
}

export default async function ShippingPage() {
  // Rates come from settings so the page can never contradict the checkout.
  const delivery = await getDeliverySettings();

  return (
    <PageBody slug="shipping-returns" fallbackTitle="Shipping and returns">
      <h2>Delivery</h2>
      <ul>
        <li>We deliver to every city and town in Pakistan through courier partners.</li>
        <li>
          Delivery costs {formatPKR(delivery.flatRatePaisa)}. Orders of {formatPKR(delivery.freeThresholdPaisa)} or more
          are delivered free.
        </li>
        <li>Typical delivery time is {DELIVERY_WINDOW} after confirmation. Remote areas can take longer.</li>
        <li>We call your number before dispatch. If we cannot reach you in two days, the order is cancelled.</li>
      </ul>
      <h2>Cash on delivery</h2>
      <p>
        Pay the rider the exact amount on your confirmation page. Riders do not carry change for large notes, so keep
        the amount ready. Refusing a confirmed parcel repeatedly may limit future COD orders.
      </p>
      <h2>Returns and replacements</h2>
      <ul>
        <li>Damaged, leaking or wrong items are replaced free. Message us within 7 days of delivery with a photo.</li>
        <li>Opened personal-care products cannot be returned for change of mind, for hygiene reasons.</li>
        <li>Unopened items can be returned within 7 days. The return courier charge is deducted from the refund.</li>
        <li>Refunds are made by bank transfer or Easypaisa/JazzCash within 5 working days of receiving the return.</li>
      </ul>
      <h2>Cancellations</h2>
      <p>
        Cancel any time before dispatch by messaging us with your order number. After dispatch, refuse the parcel at the
        door.
      </p>
    </PageBody>
  );
}
