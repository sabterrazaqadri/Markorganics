import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <div className="container-x relative py-8 md:py-12">
      <h1 className="text-3xl sm:text-4xl">Checkout</h1>
      <p className="mt-2 text-ink-soft">One page, no account needed. Pay cash on delivery.</p>
      <CheckoutForm />
    </div>
  );
}
