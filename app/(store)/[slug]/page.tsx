import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPage, listPublishedPageSlugs, renderRichText } from "@/lib/content";
import { toPlainText } from "@/lib/rich-text";

export const revalidate = 3600;
export const dynamicParams = true;

/**
 * Any published page that does not have a hand-built route of its own.
 *
 * Static segments win in Next's router, so /about, /cart and the rest are
 * never reached here — this only serves pages created in the admin, plus the
 * reserved policy slugs (terms, refund) that have no bespoke layout.
 */
/** Slugs that already have a hand-built route of their own. */
const HANDWRITTEN = new Set([
  "about",
  "privacy",
  "shipping-returns",
  "faq",
  "contact",
  "track",
  "cart",
  "checkout",
  "products",
  "blog",
  "collections",
  "order",
]);

export async function generateStaticParams() {
  const slugs = await listPublishedPageSlugs().catch(() => []);
  return slugs.filter((slug) => !HANDWRITTEN.has(slug)).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) return { title: "Not found", robots: { index: false, follow: false } };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || toPlainText(page.body, 155),
    alternates: { canonical: `/${page.slug}` },
  };
}

export default async function DatabasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (HANDWRITTEN.has(slug)) notFound();
  const page = await getPublishedPage(slug);
  if (!page) notFound();

  return (
    <div className="container-x py-8 md:py-12">
      <h1 className="text-3xl sm:text-4xl">{page.title}</h1>
      <div className="prose-plain mt-6 max-w-2xl" dangerouslySetInnerHTML={{ __html: renderRichText(page.body) }} />
    </div>
  );
}
