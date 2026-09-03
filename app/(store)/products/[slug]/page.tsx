import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveProducts, getProductBySlug, getProductsByFamily } from "@/lib/queries/products";
import { FAMILIES } from "@/lib/catalog";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PurchasePanel } from "@/components/product/PurchasePanel";
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { ProductCard } from "@/components/product/ProductCard";
import { Accordion } from "@/components/ui/Accordion";
import { breadcrumbJsonLd, jsonLdString, productJsonLd } from "@/lib/jsonld";
import { formatPKR } from "@/lib/money";

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
    title: `${product.name} - ${formatPKR(min)}`,
    description: product.shortDescription,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const fam = FAMILIES[product.family];
  const related = (await getProductsByFamily(product.family)).filter((p) => p.id !== product.id).slice(0, 4);

  const accordion = [
    {
      id: "how-to-use",
      title: "How to use",
      defaultOpen: true,
      content: (
        <ol className="list-decimal space-y-1.5 pl-5">
          {product.howToUse.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      ),
    },
    {
      id: "ingredients",
      title: "Ingredients",
      content: <p>{product.ingredients}</p>,
    },
    {
      id: "benefits",
      title: "Benefits",
      content: (
        <ul className="list-disc space-y-1.5 pl-5">
          {product.benefits.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(productJsonLd(product)) }} />
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
            <p className={`text-sm font-medium ${fam.text}`}>{fam.heading}</p>
            <h1 className="mt-1 text-3xl sm:text-4xl">{product.name}</h1>
            <p className="mt-3 text-lg text-ink-soft">{product.shortDescription}</p>

            <div className="mt-6">
              <PurchasePanel
                product={{ slug: product.slug, name: product.name, family: product.family, image: product.images[0] ?? "" }}
                variants={product.variants.map((v) => ({
                  id: v.id,
                  sku: v.sku,
                  label: v.label,
                  pricePaisa: v.pricePaisa,
                  compareAtPaisa: v.compareAtPaisa,
                  stock: v.stock,
                }))}
              />
            </div>

            <div className="mt-8">
              <h2 className="sr-only">About this product</h2>
              <p className="text-ink-soft">{product.longDescription}</p>
            </div>

            <div className="mt-8">
              <Accordion items={accordion} />
            </div>
          </div>
        </div>

        {related.length ? (
          <section aria-labelledby="related-title" className="mt-16 border-t border-rule pt-10">
            <h2 id="related-title" className="text-2xl sm:text-3xl">
              More from {fam.name.toLowerCase()}
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
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
