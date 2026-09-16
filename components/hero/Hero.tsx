import Link from "next/link";
import Image from "next/image";
import type { ProductWithVariants } from "@/lib/db/schema";
import type { RatingSummary } from "@/lib/reviews";
import { formatPKR } from "@/lib/money";
import { DELIVERY_WINDOW, SITE_URL } from "@/config/commerce";
import { DELIVERY_WINDOW_UR } from "@/lib/i18n/checkout";
import { Stars } from "@/components/product/Stars";
import { HeroBottle } from "./HeroBottle";
import { HeroBuy } from "./HeroBuy";

interface Props {
  featured?: ProductWithVariants | null;
  rating?: RatingSummary;
  soldLast30Days?: number;
}

/**
 * The homepage opens on one product: Josh. Everything in the hero is live
 * from the catalogue (price, compare-at, stock, rating), so a price change in
 * the admin is a hero change. Falls back to the brand hero when the featured
 * product is missing or unpublished.
 */
export function Hero({ featured, rating, soldLast30Days = 0 }: Props) {
  if (!featured || featured.variants.length === 0) return <BrandHero />;

  const variant = featured.variants.find((v) => v.stock > 0) ?? featured.variants[0];
  const compare = variant.compareAtPaisa && variant.compareAtPaisa > variant.pricePaisa ? variant.compareAtPaisa : null;
  const savePct = compare ? Math.round(((compare - variant.pricePaisa) / compare) * 100) : 0;
  const image = featured.images[0] ?? "/hero-bottle.png";
  const url = `${SITE_URL}/products/${featured.slug}`;
  const ur = featured.i18n?.ur;

  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      {/* A quiet field of the brand green behind the pack shot; the paper stays paper. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 md:block"
        style={{ background: "radial-gradient(60% 70% at 60% 45%, rgba(46,106,101,0.12), rgba(46,106,101,0) 70%)" }}
      />
      <div className="container-x relative grid items-center gap-8 py-8 md:grid-cols-2 md:gap-12 md:py-14 lg:py-20">
        <div className="order-2 md:order-1">
          <p className="font-display text-sm font-semibold tracking-tight text-ink-soft">
            <span className="lang-en">MARKORGANIC · Herbal massage oil for men</span>
            <span className="lang-ur urdu" lang="ur">
              مارک آرگینک · مردوں کے لیے ہربل مساج آئل
            </span>
          </p>
          <h1 id="hero-title" className="mt-3 text-4xl sm:text-5xl lg:text-[3.5rem]">
            <span className="lang-en">Josh. Warmth you feel in a minute, made in Pakistan.</span>
            <span className="lang-ur urdu" lang="ur">
              جوش۔ ایک منٹ میں گرماہٹ، پاکستان میں تیار۔
            </span>
          </h1>
          <p className="mt-5 text-lg text-ink-soft">
            <span className="lang-en">{featured.shortDescription}</span>
            <span className="lang-ur urdu" lang="ur">
              {ur?.shortDescription ?? featured.shortDescription}
            </span>
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="tabular text-3xl font-semibold">{formatPKR(variant.pricePaisa)}</span>
            {compare ? (
              <>
                <s className="tabular text-lg text-ink-soft">{formatPKR(compare)}</s>
                <span className="rounded bg-band-care/10 px-2 py-0.5 text-sm font-medium text-band-care">
                  <span className="lang-en">Save {savePct}%</span>
                  <span className="lang-ur urdu" lang="ur">
                    {savePct}% بچت
                  </span>
                </span>
              </>
            ) : null}
            <span className="text-sm text-ink-soft">· {variant.label}</span>
          </div>

          {rating && rating.count > 0 ? (
            <Link href={`/products/${featured.slug}#reviews`} className="mt-2 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
              <Stars value={rating.average} size={16} />
              <span className="tabular font-medium text-ink">{rating.average.toFixed(1)}</span>
              <span>
                <span className="lang-en">
                  ({rating.count} review{rating.count === 1 ? "" : "s"})
                </span>
                <span className="lang-ur urdu" lang="ur">
                  ({rating.count} آراء)
                </span>
              </span>
            </Link>
          ) : soldLast30Days >= 10 ? (
            <p className="mt-2 text-sm text-ink-soft">
              <span className="lang-en">{soldLast30Days} sold in the last 30 days</span>
              <span className="lang-ur urdu" lang="ur">
                اس مہینے {soldLast30Days} فروخت
              </span>
            </p>
          ) : null}

          <div className="mt-7">
            <HeroBuy
              product={{ slug: featured.slug, name: featured.name, image, url }}
              variant={{ id: variant.id, sku: variant.sku, label: variant.label, pricePaisa: variant.pricePaisa, stock: variant.stock }}
            />
            <Link href={`/products/${featured.slug}`} className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
              <span className="lang-en">Ingredients, how to use and reviews</span>
              <span className="lang-ur urdu" lang="ur">
                اجزاء، استعمال کا طریقہ اور آراء
              </span>
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
            <li>
              <span className="lang-en">Cash on delivery</span>
              <span className="lang-ur urdu" lang="ur">
                ڈیلیوری پر ادائیگی
              </span>
            </li>
            <li>
              <span className="lang-en">Delivery in {DELIVERY_WINDOW}</span>
              <span className="lang-ur urdu" lang="ur">
                {DELIVERY_WINDOW_UR} میں ڈیلیوری
              </span>
            </li>
            <li>
              <span className="lang-en">Plain, discreet packaging</span>
              <span className="lang-ur urdu" lang="ur">
                سادہ، رازدارانہ پیکنگ
              </span>
            </li>
            <li>
              <span className="lang-en">7-day easy returns</span>
              <span className="lang-ur urdu" lang="ur">
                7 دن میں آسان واپسی
              </span>
            </li>
          </ul>
        </div>

        <div className="order-1 md:order-2">
          <Link href={`/products/${featured.slug}`} className="block" aria-label={`${featured.name}, see product`}>
            <div className="relative mx-auto aspect-[4/5] w-full max-w-[460px] lg:max-w-[520px]">
              <Image
                src={image}
                alt={`${featured.name} ${variant.label} bottle with its box`}
                fill
                priority
                fetchPriority="high"
                sizes="(min-width: 1024px) 520px, (min-width: 768px) 46vw, 92vw"
                className="object-contain"
              />
            </div>
          </Link>
          {featured.images.length > 1 ? (
            <ul className="mt-3 flex justify-center gap-2" aria-label="More photos">
              {featured.images.slice(1, 4).map((src, i) => (
                <li key={src}>
                  <Link href={`/products/${featured.slug}`} className="block overflow-hidden rounded border border-rule bg-white hover:border-ink">
                    <Image src={src} alt="" width={64} height={64} sizes="64px" className="h-16 w-16 object-cover" />
                    <span className="sr-only">Photo {i + 2}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** The original brand hero, kept for when no featured product is available. */
function BrandHero() {
  return (
    <section className="container-x grid items-center gap-8 py-10 md:grid-cols-2 md:gap-12 md:py-16 lg:py-20" aria-labelledby="hero-title">
      <div className="order-2 md:order-1">
        <p className="font-display text-sm font-semibold tracking-tight text-ink-soft">MARKORGANIC</p>
        <h1 id="hero-title" className="mt-3 text-4xl sm:text-5xl lg:text-[3.5rem]">
          Honest oils, balms and neel for every Pakistani home.
        </h1>
        <p className="mt-5 text-lg text-ink-soft">
          Cold-pressed hair oils, a balm for every drawer and a liquid neel that never leaves patches. Pay cash when it
          arrives.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/collections/oils" className="btn btn-band-oil">
            Shop oils
          </Link>
          <Link href="/products" className="btn btn-secondary">
            See all products
          </Link>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          <li>Cash on delivery</li>
          <li>Delivery across Pakistan</li>
          <li>7-day easy returns</li>
        </ul>
      </div>
      <div className="order-1 md:order-2">
        <HeroBottle />
      </div>
    </section>
  );
}
