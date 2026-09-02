"use server";

import { headers } from "next/headers";
import { getOrderByNumberAndPhone } from "@/lib/queries/orders";
import { normalizeOrderNumber } from "@/lib/order-number";
import { trackOrderSchema } from "@/lib/validation/checkout";
import { rateLimit } from "@/lib/rate-limit";
import { getStoreSettings } from "@/lib/settings";

export interface TrackState {
  error?: string;
  orderNumber?: string;
}

export async function trackOrder(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const parsed = trackOrderSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the order number and phone." };
  }
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
  const rl = rateLimit(`track:${ip}`, 20, 10 * 60 * 1000);
  if (!rl.ok) return { error: "Too many lookups. Try again in a few minutes." };

  const { orderNumberPrefix } = await getStoreSettings();
  const number = normalizeOrderNumber(parsed.data.orderNumber, orderNumberPrefix);
  if (!number) return { error: `Order numbers look like ${orderNumberPrefix}ABC123.` };

  const order = await getOrderByNumberAndPhone(number, parsed.data.phone);
  if (!order) return { error: "No order matches that number and phone. Check both and try again." };
  return { orderNumber: order.orderNumber };
}
