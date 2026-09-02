import { DELIVERY_WINDOW, FREE_SHIPPING_THRESHOLD_PAISA } from "@/config/commerce";
import { formatPKR } from "@/lib/money";

const items = [
  {
    title: "Cash on delivery",
    body: "No card, no advance. Pay the rider when the parcel is in your hands.",
  },
  {
    title: "Nationwide delivery",
    body: `${DELIVERY_WINDOW} to any city in Pakistan. Free above ${formatPKR(FREE_SHIPPING_THRESHOLD_PAISA)}.`,
  },
  {
    title: "Easy returns",
    body: "Wrong or damaged item? Message us within 7 days and we replace it.",
  },
];

export function TrustStrip() {
  return (
    <section aria-label="Why buy from us" className="container-x mt-12">
      <ul className="card grid divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((it) => (
          <li key={it.title} className="p-6">
            <h2 className="text-base">{it.title}</h2>
            <p className="mt-1.5 text-sm text-ink-soft">{it.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
