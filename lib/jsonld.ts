import { BRAND_NAME, DELIVERY_FEE_PAISA, SITE_URL, SUPPORT_EMAIL, WHATSAPP_NUMBER, absoluteImageUrl } from "@/config/commerce";
import type { ProductWithVariants } from "@/lib/db/schema";
import { paisaToDecimal } from "@/lib/money";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    email: SUPPORT_EMAIL,
    telephone: `+${WHATSAPP_NUMBER}`,
    areaServed: "PK",
  };
}

/**
 * Product / Offer markup for the Rich Results test.
 *
 * Required properties (name, image, offers.price, offers.priceCurrency,
 * offers.availability) are all present. The rest — priceValidUntil, the
 * shipping rate and the return policy — are the properties Search Console
 * reports as "non-critical issues" on merchant listings, so they are filled
 * in rather than left to warn.
 *
 * `sku` is the same variant SKU used as the offer id in every product feed,
 * so Google sees one offer, not several.
 */
export function productJsonLd(p: ProductWithVariants) {
  const url = `${SITE_URL}/products/${p.slug}`;
  // Prices are stable; a year out is the conventional horizon for this field.
  const priceValidUntil = new Date(Date.now() + 365 * 24 * 3600_000).toISOString().slice(0, 10);

  const shippingDetails = {
    "@type": "OfferShippingDetails",
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "PK" },
    shippingRate: {
      "@type": "MonetaryAmount",
      value: paisaToDecimal(DELIVERY_FEE_PAISA),
      currency: "PKR",
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 5, unitCode: "DAY" },
    },
  };

  const returnPolicy = {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "PK",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 7,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/FreeReturn",
  };

  const offers = p.variants.map((v) => ({
    "@type": "Offer",
    sku: v.sku,
    name: `${p.name} ${v.label}`,
    url,
    priceCurrency: "PKR",
    price: paisaToDecimal(v.pricePaisa),
    priceValidUntil,
    availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    shippingDetails,
    hasMerchantReturnPolicy: returnPolicy,
  }));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.shortDescription,
    image: p.images.map(absoluteImageUrl),
    sku: p.variants[0]?.sku,
    brand: { "@type": "Brand", name: BRAND_NAME },
    url,
    offers: offers.length === 1 ? offers[0] : offers,
  };
}

export function collectionJsonLd(opts: {
  name: string;
  description: string;
  path: string;
  products: { name: string; slug: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    isPartOf: { "@type": "WebSite", name: BRAND_NAME, url: SITE_URL },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: opts.products.length,
      itemListElement: opts.products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.name,
        url: `${SITE_URL}/products/${p.slug}`,
      })),
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

/** Renders JSON-LD safely inside a <script> tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
