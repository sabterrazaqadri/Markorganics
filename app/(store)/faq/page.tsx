import type { Metadata } from "next";
import { Accordion } from "@/components/ui/Accordion";
import { DELIVERY_FEE_PAISA, DELIVERY_WINDOW, FREE_SHIPPING_THRESHOLD_PAISA } from "@/config/commerce";
import { formatPKR } from "@/lib/money";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about delivery, cash on delivery, returns and how to use MARKORGANICS products.",
  alternates: { canonical: "/faq" },
};

const faqs = [
  {
    id: "cod",
    title: "How do I pay?",
    content: (
      <p>
        Cash on delivery only. The rider collects the exact total shown on your confirmation page. We never ask for card
        details or bank transfers.
      </p>
    ),
  },
  {
    id: "delivery-time",
    title: "How long does delivery take?",
    content: (
      <p>
        {DELIVERY_WINDOW} for most cities. We call to confirm your order first, then hand it to the courier the same or
        next working day.
      </p>
    ),
  },
  {
    id: "delivery-fee",
    title: "What does delivery cost?",
    content: (
      <p>
        {formatPKR(DELIVERY_FEE_PAISA)} flat anywhere in Pakistan. Orders of {formatPKR(FREE_SHIPPING_THRESHOLD_PAISA)} or
        more ship free.
      </p>
    ),
  },
  {
    id: "returns",
    title: "Can I return a product?",
    content: (
      <p>
        If an item arrives damaged, leaking or is not what you ordered, message us within 7 days and we replace it at no
        cost. Opened products cannot be returned for change of mind.
      </p>
    ),
  },
  {
    id: "cancel",
    title: "Can I cancel an order?",
    content: <p>Yes, any time before it ships. Message us on WhatsApp with your order number.</p>,
  },
  {
    id: "track",
    title: "How do I track my order?",
    content: <p>Use the Track order page with your order number and the phone number from checkout.</p>,
  },
  {
    id: "safety",
    title: "Are the oils safe for children?",
    content: (
      <p>
        Mustard and coconut oil are traditional for baby massage from six months. Onion Oil, the balms and Josh
        are for adults. Always patch-test first.
      </p>
    ),
  },
];

export default function FaqPage() {
  return (
    <div className="container-x py-8 md:py-12">
      <h1 className="text-3xl sm:text-4xl">Frequently asked questions</h1>
      <div className="mt-8 max-w-2xl">
        <Accordion items={faqs} />
      </div>
    </div>
  );
}
