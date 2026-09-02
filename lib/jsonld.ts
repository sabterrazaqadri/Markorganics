import { BRAND_NAME, SITE_URL, SUPPORT_EMAIL, WHATSAPP_NUMBER } from "@/config/commerce";
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

export function productJsonLd(p: ProductWithVariants) {
  const url = `${SITE_URL}/products/${p.slug}`;
  const offers = p.variants.map((v) => ({
    "@type": "Offer",
    sku: v.sku,
    name: `${p.name} ${v.label}`,
    url,
    priceCurrency: "PKR",
    price: paisaToDecimal(v.pricePaisa),
    availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "PK" },
    },
  }));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.shortDescription,
    image: p.images.map((i) => `${SITE_URL}${i}`),
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
