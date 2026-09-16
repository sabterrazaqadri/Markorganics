import type { Metadata } from "next";
import { TrackForm } from "@/components/order/TrackForm";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check the status of your MARKORGANIC order with your order number and phone number.",
  alternates: { canonical: "/track" },
};

export default function TrackPage() {
  return (
    <div className="container-x py-8 md:py-12">
      <h1 className="text-3xl sm:text-4xl">Track your order</h1>
      <p className="mt-2 max-w-xl text-ink-soft">
        Enter the order number from your confirmation page and the mobile number you used at checkout.
      </p>
      <TrackForm />
    </div>
  );
}
