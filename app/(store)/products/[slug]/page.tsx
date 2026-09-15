import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveProducts, getProductBySlug, getProductsByFamily } from "@/lib/queries/products";
import { FAMILIES } from "@/lib/catalog";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PurchasePanel } from "@/components/product/PurchasePanel";
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductCopy, ProductIntro } from "@/components/product/ProductCopy";
import { TrustBadges } from "@/components/product/TrustBadges";
import { BundleContents } from "@/components/product/BundleContents";
import { Reviews } from "@/components/product/Reviews";
import { Stars } from "@/components/product/Stars";
import { breadcrumbJsonLd, faqJsonLd, jsonLdString, productJsonLd } from "@/lib/jsonld";
import { formatPKR } from "@/lib/money";
import { SITE_URL } from "@/config/commerce";
import { getApprovedReviews, getRatingSummaries, getRatingSummary } from "@/lib/reviews";
import { getRecentOrderCount, getSoldCounts } from "@/lib/queries/social-proof";
import { getBundleComponents } from "@/lib/bundles";
import { db } from "@/lib/db";
import { getStoreSettings, paymentMethodsOf } from "@/lib/settings";

export const revalidate = 60;
export const dynamicParams = true;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const products = await getActiveProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  const min = Math.min(...product.variants.map((v) => v.pricePaisa));
  return {
    title: product.seoTitle || `${product.name} - ${formatPKR(min)}`,
    description: product.seoDescription || product.shortDescription,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      type: "website",
      images: product.images[0] ? [{ url: product.images[0] }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const fam = FAMILIES[product.family];
  const [relatedRaw, summary, reviews, sold, orderedToday, components, store] = await Promise.all([
    getProductsByFamily(product.family),
    getRatingSummary(product.id),
    getApprovedReviews(product.id, 20),
    getSoldCounts([product.id]),
    getRecentOrderCount(product.id),
    product.isBundle ? getBundleComponents(db, product.variants.map((v) => v.id)) : Promise.resolve(new Map()),
    getStoreSettings(),
  ]);
  const related = relatedRaw.filter((p) => p.id !== product.id).slice(0, 4);
  const relatedRatings = await getRatingSummaries(related.map((p) => p.id));
  const social = {
    soldLast30Days: sold.get(product.id)?.last30Days ?? 0,
    orderedToday,
  };
  const productUrl = `${SITE_URL}/products/${product.slug}`;
  const firstVariant = product.variants[0];
  const bundleParts = firstVariant ? (components.get(firstVariant.id) ?? []) : [];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(productJsonLd(product, { summary, reviews })) }}
      />
      {product.faqs?.length ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd(product.faqs)) }} />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: fam.heading, path: `/collections/${product.family}` },
              { name: product.name, path: `/products/${product.slug}` },
            ]),
          ),
        }}
      />
      <div className={`band ${fam.band}`} aria-hidden="true" />
      <div className="container-x py-6 md:py-10">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
          <ol className="flex flex-wrap gap-1.5">
            <li>
              <Link href="/" className="hover:underline underline-offset-4">
                Home
              </Link>
              <span aria-hidden="true"> /</span>
            </li>
            <li>
              <Link href={`/collections/${product.family}`} className="hover:underline underline-offset-4">
                {fam.name}
              </Link>
              <span aria-hidden="true"> /</span>
            </li>
            <li aria-current="page" className="text-ink">
              {product.name}
            </li>
          </ol>
        </nav>

        <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-12">
          <TrackEvent
            event="view_item"
            valuePaisa={product.variants[0]?.pricePaisa ?? 0}
            items={product.variants.slice(0, 1).map((v) => ({
              sku: v.sku,
              name: `${product.name} ${v.label}`,
              quantity: 1,
              pricePaisa: v.pricePaisa,
            }))}
          />
          <ProductGallery images={product.images} name={product.name} />

          <div>
            <ProductIntro product={product} eyebrow={product.isBundle ? "Kit" : fam.heading} eyebrowClass={fam.text} />

            {summary.count > 0 ? (
              <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
                <Stars value={summary.average} size={16} />
                <span className="tabular font-medium text-ink">{summary.average.toFixed(1)}</span>
                <span>
                  ({summary.count} review{summary.count === 1 ? "" : "s"})
                </span>
              </a>
            ) : null}

            <div className="mt-6">
              <PurchasePanel
                product={{ slug: product.slug, name: product.name, family: product.family, image: product.images[0] ?? "", url: productUrl }}
                variants={product.variants.map((v) => ({
                  id: v.id,
                  sku: v.sku,
                  label: v.label,
                  pricePaisa: v.pricePaisa,
                  compareAtPaisa: v.compareAtPaisa,
                  stock: v.stock,
                  lowStockThreshold: v.lowStockThreshold,
                }))}
                social={social}
              />
            </div>

            {product.isBundle && firstVariant && bundleParts.length ? (
              <BundleContents components={bundleParts} bundlePricePaisa={firstVariant.pricePaisa} />
            ) : null}

            <TrustBadges paymentMethods={paymentMethodsOf(store)} paymentNote={store.paymentNote} />

            <ProductCopy product={product} />
          </div>
        </div>

        <Reviews productSlug={product.slug} summary={summary} reviews={reviews} />

        {related.length ? (
          <section aria-labelledby="related-title" className="mt-16 border-t border-rule pt-10">
            <h2 id="related-title" className="text-2xl sm:text-3xl">
              More from {fam.name.toLowerCase()}
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} rating={relatedRatings.get(p.id)} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      {/* spacer so the mobile sticky bar never covers the footer links */}
      <div className="h-20 md:hidden" aria-hidden="true" />
    </>
  );
}
