import type { Metadata } from "next";
import { Hero } from "@/components/hero/Hero";
import { FamilySection } from "@/components/home/FamilySection";
import { TrustStrip } from "@/components/home/TrustStrip";
import { BrandStory } from "@/components/home/BrandStory";
import { FeaturedReviews } from "@/components/home/FeaturedReviews";
import { ProductCard } from "@/components/product/ProductCard";
import { getActiveProducts } from "@/lib/queries/products";
import { FAMILY_ORDER } from "@/lib/catalog";
import { jsonLdString, organizationJsonLd } from "@/lib/jsonld";
import { BRAND_NAME, FEATURED_PRODUCT_SLUG } from "@/config/commerce";
import { getApprovedReviews, getRatingSummaries } from "@/lib/reviews";
import { getSoldCounts } from "@/lib/queries/social-proof";

export const revalidate = 60;

export const metadata: Metadata = {
  title: `${BRAND_NAME} - Josh herbal massage oil for men, hair oils, balm and neel`,
  description:
    "Josh herbal massage oil for men, cold-pressed mustard, coconut and onion oils, MARK Balm and Iodex for pain relief, and MARK Liquid Neel. Cash on delivery across Pakistan.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const products = await getActiveProducts();
  const featured = products.find((p) => p.slug === FEATURED_PRODUCT_SLUG) ?? null;
  const [ratings, sold, featuredReviews] = await Promise.all([
    getRatingSummaries(products.map((p) => p.id)),
    featured ? getSoldCounts([featured.id]) : Promise.resolve(new Map()),
    featured ? getApprovedReviews(featured.id, 3) : Promise.resolve([]),
  ]);
  const bestsellers = products.filter((p) => p.isBestseller).slice(0, 4);
  const kits = products.filter((p) => p.isBundle);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(organizationJsonLd()) }} />
      <Hero
        featured={featured}
        rating={featured ? ratings.get(featured.id) : undefined}
        soldLast30Days={featured ? (sold.get(featured.id)?.last30Days ?? 0) : 0}
      />

      {featured && featuredReviews.length ? <FeaturedReviews product={featured} reviews={featuredReviews} /> : null}

      {kits.length ? (
        <section aria-labelledby="kits-title" className="container-x mt-8 border-t border-rule pt-10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="kits-title" className="text-3xl sm:text-4xl">
                <span className="lang-en">Kits that save</span>
                <span className="lang-ur urdu" lang="ur">
                  بچت والی کٹس
                </span>
              </h2>
              <p className="mt-2 text-ink-soft">
                <span className="lang-en">Two things that belong together, priced below buying them apart. Free delivery on every kit over the threshold.</span>
                <span className="lang-ur urdu" lang="ur">
                  دو چیزیں جو ساتھ چلتی ہیں، الگ خریدنے سے کم قیمت پر۔
                </span>
              </p>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kits.map((p) => (
              <ProductCard key={p.id} product={p} rating={ratings.get(p.id)} />
            ))}
          </div>
        </section>
      ) : null}

      {FAMILY_ORDER.map((family) => (
        <FamilySection
          key={family}
          family={family}
          products={products.filter((p) => p.family === family && !p.isBundle)}
          ratings={ratings}
        />
      ))}

      {bestsellers.length ? (
        <section aria-labelledby="bestsellers-title" className="container-x mt-8 border-t border-rule pt-10">
          <h2 id="bestsellers-title" className="text-3xl sm:text-4xl">
            Bestsellers
          </h2>
          <p className="mt-2 text-ink-soft">What most customers order first.</p>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {bestsellers.map((p) => (
              <ProductCard key={p.id} product={p} rating={ratings.get(p.id)} />
            ))}
          </div>
        </section>
      ) : null}

      <TrustStrip />
      <BrandStory />
    </>
  );
}
