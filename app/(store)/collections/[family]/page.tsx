import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product/ProductCard";
import { getProductsByFamily } from "@/lib/queries/products";
import { FAMILIES, FAMILY_ORDER, isFamily, type Family } from "@/lib/catalog";
import { COLLECTIONS } from "@/lib/collections";
import { breadcrumbJsonLd, collectionJsonLd, jsonLdString } from "@/lib/jsonld";

export const revalidate = 60;
export const dynamicParams = false;

interface Props {
  params: Promise<{ family: string }>;
}

export function generateStaticParams() {
  return FAMILY_ORDER.map((family) => ({ family }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { family } = await params;
  if (!isFamily(family)) return { title: "Not found" };
  const copy = COLLECTIONS[family];
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: `/collections/${family}` },
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: `/collections/${family}`,
      type: "website",
    },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { family } = await params;
  if (!isFamily(family)) notFound();

  const fam = FAMILIES[family as Family];
  const copy = COLLECTIONS[family as Family];
  const products = await getProductsByFamily(family as Family);
  const anyInStock = products.some((p) => p.variants.some((v) => v.stock > 0));
  const others = FAMILY_ORDER.filter((f) => f !== family);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            collectionJsonLd({
              name: copy.heading,
              description: copy.description,
              path: `/collections/${family}`,
              products: products.map((p) => ({ name: p.name, slug: p.slug })),
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Products", path: "/products" },
              { name: copy.heading, path: `/collections/${family}` },
            ]),
          ),
        }}
      />

      <div className={`band ${fam.band}`} aria-hidden="true" />

      <div className="container-x py-8 md:py-12">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
          <ol className="flex flex-wrap gap-1.5">
            <li>
              <Link href="/" className="hover:underline underline-offset-4">
                Home
              </Link>
              <span aria-hidden="true"> /</span>
            </li>
            <li>
              <Link href="/products" className="hover:underline underline-offset-4">
                Products
              </Link>
              <span aria-hidden="true"> /</span>
            </li>
            <li aria-current="page" className="text-ink">
              {fam.name}
            </li>
          </ol>
        </nav>

        <h1 className="mt-4 text-3xl sm:text-4xl">{copy.heading}</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">{copy.standfirst}</p>

        {products.length === 0 ? (
          <div className="card mt-8 max-w-xl p-6">
            <p className="text-ink-soft">
              There is nothing in {fam.name.toLowerCase()} yet. The other two families are stocked, or you can see
              everything on one page.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {others.map((f) => (
                <Link key={f} href={`/collections/${f}`} className="btn btn-sm btn-secondary">
                  {FAMILIES[f].name}
                </Link>
              ))}
              <Link href="/products" className="btn btn-sm btn-primary">
                All products
              </Link>
            </div>
          </div>
        ) : (
          <>
            {!anyInStock ? (
              <p role="status" className="mt-6 max-w-2xl rounded border border-rule bg-surface px-4 py-3 text-sm">
                Everything in {fam.name.toLowerCase()} is sold out right now. We restock most weeks, so check back or
                message us on WhatsApp and we will tell you when it lands.
              </p>
            ) : null}
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 2} />
              ))}
            </div>
          </>
        )}

        <div className="prose-plain mt-12 max-w-2xl border-t border-rule pt-8">
          <h2 className="text-2xl">About {copy.heading.toLowerCase()}</h2>
          {copy.body.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        <nav aria-label="Other families" className="mt-10 border-t border-rule pt-6">
          <h2 className="text-sm font-semibold">Other families</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {others.map((f) => (
              <Link key={f} href={`/collections/${f}`} className="btn btn-sm btn-secondary">
                {FAMILIES[f].heading}
              </Link>
            ))}
            <Link href="/products" className="btn btn-sm btn-secondary">
              All products
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
