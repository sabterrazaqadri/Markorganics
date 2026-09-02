import type { Metadata } from "next";
import { CartPage } from "@/components/cart/CartPage";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false },
};

export default function Page() {
  return (
    <div className="container-x py-8 md:py-12">
      <h1 className="text-3xl sm:text-4xl">Cart</h1>
      <CartPage />
    </div>
  );
}
