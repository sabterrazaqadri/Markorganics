import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/commerce";
import { getActiveProducts } from "@/lib/queries/products";
import { getPublishedPosts, listPublishedPageSlugs } from "@/lib/content";
import { FAMILY_ORDER } from "@/lib/catalog";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, posts, pageSlugs] = await Promise.all([
    getActiveProducts(),
    getPublishedPosts(200),
    listPublishedPageSlugs(),
  ]);
  const now = new Date();

  // Pages with a hand-built route are already listed below.
  const HANDWRITTEN = new Set(["about", "privacy", "shipping-returns", "faq", "contact", "track"]);

  const statics: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/products`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...FAMILY_ORDER.map((f) => ({
      url: `${SITE_URL}/collections/${f}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/shipping-returns`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/track`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [
    ...statics,
    ...products.map((p) => ({
      url: `${SITE_URL}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...(posts.length
      ? [{ url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 }]
      : []),
    ...posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...pageSlugs
      .filter((slug) => !HANDWRITTEN.has(slug))
      .map((slug) => ({
        url: `${SITE_URL}/${slug}`,
        lastModified: now,
        changeFrequency: "yearly" as const,
        priority: 0.3,
      })),
  ];
}
