import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product/ProductCard";
import { getActiveProducts } from "@/lib/queries/products";
import { FAMILIES, FAMILY_ORDER } from "@/lib/catalog";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "All products",
  description:
    "Every MARKORGANIC product on one page: hair and body oils, pain relief balms and liquid neel. Cash on delivery across Pakistan.",
  alternates: { canonical: "/products" },
};

/** Family buttons link to the static collection pages; nothing here reads a query string. */
const bandBtn: Record<string, string> = {
  oils: "btn-band-oil",
  relief: "btn-band-care",
  home: "btn-band-home",
};

export default async function ProductsPage() {
  const products = await getActiveProducts();

  return (
    <div className="container-x py-8 md:py-12">
      <h1 className="text-3xl sm:text-4xl">All products</h1>
      <p className="mt-2 text-ink-soft">Seven products, three families. Cash on delivery across Pakistan.</p>

      <nav aria-label="Browse by family" className="mt-6 flex flex-wrap gap-2">
        <span aria-current="page" className="btn btn-sm btn-primary pointer-events-none">
          All
        </span>
        {FAMILY_ORDER.map((f) => (
          <Link key={f} href={`/collections/${f}`} className={`btn btn-sm ${bandBtn[f]}`}>
            {FAMILIES[f].name}
          </Link>
        ))}
      </nav>

      {products.length === 0 ? (
        <div className="card mt-8 max-w-xl p-6">
          <p className="text-ink-soft">
            The catalogue is empty right now. Message us on WhatsApp and we will tell you when stock is back.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </div>
      )}
    </div>
  );
}
