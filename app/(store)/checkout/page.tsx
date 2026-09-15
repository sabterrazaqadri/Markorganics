import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { getStoreSettings, paymentMethodsOf } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default async function CheckoutPage() {
  const store = await getStoreSettings();
  return (
    <div className="container-x relative py-8 md:py-12">
      <h1 className="text-3xl sm:text-4xl">
        <span className="lang-en">Checkout</span>
        <span className="lang-ur urdu" lang="ur">
          آرڈر مکمل کریں
        </span>
      </h1>
      <p className="mt-2 text-ink-soft">
        <span className="lang-en">One page, no account needed. Pay cash on delivery.</span>
        <span className="lang-ur urdu" lang="ur">
          ایک ہی صفحہ، اکاؤنٹ کی ضرورت نہیں۔ ادائیگی ڈیلیوری پر نقد۔
        </span>
      </p>
      <CheckoutForm paymentMethods={paymentMethodsOf(store)} paymentNote={store.paymentNote} />
    </div>
  );
}
