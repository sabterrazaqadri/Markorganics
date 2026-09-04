import "server-only";
import { BRAND_NAME, SITE_URL } from "@/config/commerce";
import { FAMILIES } from "@/lib/catalog";
import type { ProductWithVariants } from "@/lib/db/schema";
import { paisaToDecimal } from "@/lib/money";

/**
 * One builder, three destinations.
 *
 * RSS 2.0 with the Google Merchant namespace is accepted by Google Merchant
 * Center, by Meta Commerce Manager and by TikTok's catalogue, which all read
 * the same g: fields — so the feed is written once and the target only
 * changes the handful of fields that genuinely differ.
 *
 * On product ids: `g:id` is the variant SKU, which is unique in the database
 * and never reused. That is what satisfies Merchant Center's requirement
 * (tightened in March 2026) that an offer id be unique per offer, stable over
 * time, and identical wherever the same offer appears — the same SKU is used
 * in this feed, in the Meta feed, in the TikTok feed and in the Product
 * JSON-LD on the product page, so the offer is one offer everywhere.
 */

export type FeedTarget = "google" | "meta" | "tiktok";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const GOOGLE_CATEGORY: Record<string, string> = {
  oils: "Health &amp; Beauty &gt; Personal Care &gt; Cosmetics &gt; Hair Care &gt; Hair Oil",
  relief: "Health &amp; Beauty &gt; Health Care &gt; Medicine &amp; Drugs",
  home: "Home &amp; Garden &gt; Household Supplies &gt; Laundry Supplies",
};

const FEED_TITLE: Record<FeedTarget, string> = {
  google: "Google Merchant Center",
  meta: "Meta Commerce Manager",
  tiktok: "TikTok catalogue",
};

export interface FeedOptions {
  /** Flat delivery fee advertised in the feed, in paisa. */
  deliveryPaisa?: number;
}

export function buildProductFeed(
  products: ProductWithVariants[],
  target: FeedTarget,
  options: FeedOptions = {},
): string {
  const deliveryPaisa = options.deliveryPaisa ?? 200 * 100;

  const items = products.flatMap((p) =>
    p.variants.map((v) => {
      const link = `${SITE_URL}/products/${p.slug}`;
      const image = p.images[0] ? `${SITE_URL}${p.images[0]}` : `${SITE_URL}/hero-bottle.png`;
      const extra = p.images
        .slice(1, 10)
        .map((i) => `      <g:additional_image_link>${esc(SITE_URL + i)}</g:additional_image_link>`);
      const onSale = Boolean(v.compareAtPaisa && v.compareAtPaisa > v.pricePaisa);
      const basePrice = onSale ? v.compareAtPaisa! : v.pricePaisa;
      const salePrice = onSale ? `      <g:sale_price>${paisaToDecimal(v.pricePaisa)} PKR</g:sale_price>` : "";
      // Draft and archived products never reach this function, so availability
      // is purely a stock question.
      const availability = v.stock > 0 ? "in_stock" : "out_of_stock";

      return [
        "    <item>",
        `      <g:id>${esc(v.sku)}</g:id>`,
        `      <g:title>${esc(`${p.name} ${v.label}`)}</g:title>`,
        `      <g:description>${esc(p.longDescription || p.shortDescription)}</g:description>`,
        `      <g:link>${esc(link)}</g:link>`,
        `      <g:image_link>${esc(image)}</g:image_link>`,
        ...extra,
        `      <g:availability>${availability}</g:availability>`,
        `      <g:price>${paisaToDecimal(basePrice)} PKR</g:price>`,
        salePrice,
        `      <g:brand>${esc(BRAND_NAME)}</g:brand>`,
        `      <g:condition>new</g:condition>`,
        // Every size of a product is one group, so the 50ml and 100ml variants
        // show as one listing with a size selector rather than two listings.
        `      <g:item_group_id>${esc(p.slug)}</g:item_group_id>`,
        `      <g:product_type>${esc(FAMILIES[p.family].heading)}</g:product_type>`,
        `      <g:google_product_category>${GOOGLE_CATEGORY[p.family]}</g:google_product_category>`,
        // No GTIN: these are own-brand goods with no barcode allocation, so the
        // SKU is the MPN and identifier_exists says so explicitly.
        `      <g:mpn>${esc(v.sku)}</g:mpn>`,
        `      <g:identifier_exists>no</g:identifier_exists>`,
        `      <g:size>${esc(v.label)}</g:size>`,
        target === "meta" ? `      <g:inventory>${v.stock}</g:inventory>` : "",
        target === "tiktok" ? `      <g:quantity_to_sell_on_facebook>${v.stock}</g:quantity_to_sell_on_facebook>` : "",
        `      <g:shipping><g:country>PK</g:country><g:service>Courier</g:service><g:price>${paisaToDecimal(deliveryPaisa)} PKR</g:price></g:shipping>`,
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
    `    <description>${esc(`${BRAND_NAME} product feed for ${FEED_TITLE[target]}`)}</description>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

/* ------------------------------------------------------------ validation */

export interface FeedProblem {
  sku: string;
  field: string;
  message: string;
}

/**
 * The checks Merchant Center actually rejects on, run before Google does.
 *
 * Nothing here is a guess about the March 2026 change: it is the same
 * uniqueness-and-stability requirement applied to the ids this feed emits, so
 * a duplicate or over-long SKU is caught here rather than in a disapproval
 * email a week later.
 */
export function validateFeed(products: ProductWithVariants[]): FeedProblem[] {
  const problems: FeedProblem[] = [];
  const seen = new Map<string, string>();

  for (const product of products) {
    for (const variant of product.variants) {
      const sku = variant.sku.trim();
      const add = (field: string, message: string) => problems.push({ sku: sku || variant.id, field, message });

      if (!sku) add("id", "This variant has no SKU, so it has no feed id.");
      else if (sku.length > 50) add("id", "Merchant Center caps the offer id at 50 characters.");
      else if (seen.has(sku)) add("id", `SKU is also used by "${seen.get(sku)}". Offer ids must be unique.`);
      else seen.set(sku, `${product.name} ${variant.label}`);

      if (!product.images.length) add("image_link", "No image. Merchant Center rejects offers without one.");
      if (variant.pricePaisa <= 0) add("price", "Price is zero.");
      if (!`${product.name} ${variant.label}`.trim()) add("title", "Empty title.");
      if (!(product.longDescription || product.shortDescription).trim()) add("description", "Empty description.");
      if (!product.slug) add("item_group_id", "No slug, so variants cannot be grouped.");
      if ((`${product.name} ${variant.label}`).length > 150) {
        add("title", "Title is over 150 characters and will be truncated.");
      }
    }
  }
  return problems;
}
