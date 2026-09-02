import type { Metadata } from "next";
import { Hero } from "@/components/hero/Hero";
import { FamilySection } from "@/components/home/FamilySection";
import { TrustStrip } from "@/components/home/TrustStrip";
import { BrandStory } from "@/components/home/BrandStory";
import { ProductCard } from "@/components/product/ProductCard";
import { getActiveProducts } from "@/lib/queries/products";
import { FAMILY_ORDER } from "@/lib/catalog";
import { jsonLdString, organizationJsonLd } from "@/lib/jsonld";
import { BRAND_NAME } from "@/config/commerce";

export const revalidate = 60;

export const metadata: Metadata = {
  title: `${BRAND_NAME} - Hair oils, pain relief balm and liquid neel`,
  description:
    "Cold-pressed mustard, coconut and onion oils, MARK Balm and Iodex for pain relief, and MARK Liquid Neel. Cash on delivery across Pakistan.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const products = await getActiveProducts();
  const bestsellers = products.filter((p) => p.isBestseller).slice(0, 4);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(organizationJsonLd()) }} />
      <Hero />

      {FAMILY_ORDER.map((family) => (
        <FamilySection key={family} family={family} products={products.filter((p) => p.family === family)} />
      ))}

      {bestsellers.length ? (
        <section aria-labelledby="bestsellers-title" className="container-x mt-8 border-t border-rule pt-10">
          <h2 id="bestsellers-title" className="text-3xl sm:text-4xl">
            Bestsellers
          </h2>
          <p className="mt-2 text-ink-soft">What most customers order first.</p>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {bestsellers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      <TrustStrip />
      <BrandStory />
    </>
  );
}
