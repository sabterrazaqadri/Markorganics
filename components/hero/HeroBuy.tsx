"use client";

import { useCart } from "@/store/cart";
import { useLang } from "@/store/lang";
import { WhatsAppLink } from "@/components/analytics/WhatsAppLink";
import { formatPKR } from "@/lib/money";
import { clientEventId, trackEvent } from "@/lib/analytics/client";

export interface HeroVariant {
  id: string;
  sku: string;
  label: string;
  pricePaisa: number;
  stock: number;
}

/** The hero's two calls to action: straight into the cart, or straight to WhatsApp. */
export function HeroBuy({ product, variant }: { product: { slug: string; name: string; image: string; url: string }; variant: HeroVariant }) {
  const lang = useLang((s) => s.lang);
  const add = useCart((s) => s.add);
  const showAdded = useCart((s) => s.showAdded);
  const soldOut = variant.stock <= 0;

  function handleAdd() {
    if (soldOut) return;
    const line = {
      variantId: variant.id,
      productSlug: product.slug,
      productName: product.name,
      variantLabel: variant.label,
      sku: variant.sku,
      unitPricePaisa: variant.pricePaisa,
      image: product.image,
      maxQty: variant.stock,
    };
    add(line, 1);
    showAdded(line, 1);
    trackEvent({
      event: "add_to_cart",
      eventId: clientEventId("add_to_cart", `${variant.sku}:hero:${Date.now()}`),
      valuePaisa: variant.pricePaisa,
      items: [{ sku: variant.sku, name: `${product.name} ${variant.label}`, quantity: 1, pricePaisa: variant.pricePaisa }],
    });
  }

  const waText =
    lang === "ur"
      ? `السلام علیکم، مجھے ${product.name} ${variant.label} آرڈر کرنا ہے (${formatPKR(variant.pricePaisa)})۔\n${product.url}\nنام:\nشہر:\nپتہ:`
      : `Assalam o Alaikum, I want to order ${product.name} ${variant.label} (${formatPKR(variant.pricePaisa)}).\n${product.url}\nName:\nCity:\nAddress:`;

  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={handleAdd} disabled={soldOut} className="btn btn-band-oil min-w-52">
        {soldOut
          ? lang === "ur"
            ? "ختم"
            : "Sold out"
          : lang === "ur"
            ? `کارٹ میں ڈالیں — ${formatPKR(variant.pricePaisa)}`
            : `Add to cart — ${formatPKR(variant.pricePaisa)}`}
      </button>
      <WhatsAppLink text={waText} target="_blank" className="btn btn-secondary">
        {lang === "ur" ? "واٹس ایپ پر آرڈر کریں" : "Order on WhatsApp"}
      </WhatsAppLink>
    </div>
  );
}
