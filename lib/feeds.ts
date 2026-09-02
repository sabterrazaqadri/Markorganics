import "server-only";
import { BRAND_NAME, SITE_URL } from "@/config/commerce";
import { FAMILIES } from "@/lib/catalog";
import type { ProductWithVariants } from "@/lib/db/schema";
import { paisaToDecimal } from "@/lib/money";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const GOOGLE_CATEGORY: Record<string, string> = {
  oils: "Health &amp; Beauty &gt; Personal Care &gt; Cosmetics &gt; Hair Care &gt; Hair Oil",
  relief: "Health &amp; Beauty &gt; Health Care &gt; Medicine &amp; Drugs",
  home: "Home &amp; Garden &gt; Household Supplies &gt; Laundry Supplies",
};

/**
 * RSS 2.0 with the Google Merchant namespace. This exact format is accepted
 * by Google Merchant Center and by Meta Commerce Manager (which reads the
 * same g: fields), so both feeds share one builder.
 */
export function buildProductFeed(products: ProductWithVariants[], target: "google" | "meta"): string {
  const items = products.flatMap((p) =>
    p.variants.map((v) => {
      const link = `${SITE_URL}/products/${p.slug}`;
      const image = p.images[0] ? `${SITE_URL}${p.images[0]}` : `${SITE_URL}/hero-bottle.png`;
      const extra = p.images.slice(1, 10).map((i) => `      <g:additional_image_link>${esc(SITE_URL + i)}</g:additional_image_link>`);
      const salePrice =
        v.compareAtPaisa && v.compareAtPaisa > v.pricePaisa
          ? `      <g:sale_price>${paisaToDecimal(v.pricePaisa)} PKR</g:sale_price>`
          : "";
      const basePrice = v.compareAtPaisa && v.compareAtPaisa > v.pricePaisa ? v.compareAtPaisa : v.pricePaisa;
      return [
        "    <item>",
        `      <g:id>${esc(v.sku)}</g:id>`,
        `      <g:title>${esc(`${p.name} ${v.label}`)}</g:title>`,
        `      <g:description>${esc(p.longDescription)}</g:description>`,
        `      <g:link>${esc(link)}</g:link>`,
        `      <g:image_link>${esc(image)}</g:image_link>`,
        ...extra,
        `      <g:availability>${v.stock > 0 ? "in_stock" : "out_of_stock"}</g:availability>`,
        `      <g:price>${paisaToDecimal(basePrice)} PKR</g:price>`,
        salePrice,
        `      <g:brand>${esc(BRAND_NAME)}</g:brand>`,
        `      <g:condition>new</g:condition>`,
        `      <g:item_group_id>${esc(p.slug)}</g:item_group_id>`,
        `      <g:product_type>${esc(FAMILIES[p.family].heading)}</g:product_type>`,
        `      <g:google_product_category>${GOOGLE_CATEGORY[p.family]}</g:google_product_category>`,
        `      <g:identifier_exists>no</g:identifier_exists>`,
        `      <g:size>${esc(v.label)}</g:size>`,
        target === "meta" ? `      <g:inventory>${v.stock}</g:inventory>` : "",
        `      <g:shipping><g:country>PK</g:country><g:service>Courier</g:service><g:price>200.00 PKR</g:price></g:shipping>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    }),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "  <channel>",
    `    <title>${esc(BRAND_NAME)}</title>`,
    `    <link>${esc(SITE_URL)}</link>`,
    `    <description>${esc(`${BRAND_NAME} product feed for ${target === "google" ? "Google Merchant Center" : "Meta Commerce Manager"}`)}</description>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
