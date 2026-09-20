import Link from "next/link";
import Image from "next/image";

const APO_CONTAINER = "mx-auto w-full max-w-[1440px] px-[22px] md:px-12 lg:px-[88px]";

/**
 * The homepage hero sells the brand, not one product — price, stock and
 * add-to-cart live on the PDP (components/product/PurchasePanel.tsx). Static
 * and server-rendered.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="bg-apo-ivory">
      <div className={`${APO_CONTAINER} grid gap-10 py-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-12 lg:py-16 xl:grid-cols-[560px_1fr] xl:gap-16`}>
        <div className="max-w-140">
          <p className="font-apo-sans text-xs font-medium text-apo-gold-dark" style={{ letterSpacing: "0.22em" }}>
            <span className="lang-en">MARKORGANIC · KARACHI</span>
            <span className="lang-ur urdu" lang="ur">
              مارک آرگینک · کراچی
            </span>
          </p>

          <h1
            id="hero-title"
            className="mt-3 font-apo-display text-[38px] font-normal text-apo-ink lg:text-[70px]"
            style={{ lineHeight: 1.03, letterSpacing: "-0.02em" }}
          >
            <span className="lang-en">
              Made for the shelf,
              <br className="hidden xl:block" /> not the shop window.
            </span>
            <span className="lang-ur urdu" lang="ur" style={{ lineHeight: 1.9 }}>
              شیلف کے لیے بنایا گیا، دکھاوے کی دکان کے لیے نہیں۔
            </span>
          </h1>

          <p className="mt-5 max-w-117.5 font-apo-sans text-lg text-apo-body" style={{ lineHeight: 1.62 }}>
            <span className="lang-en">
              Herbal oils and balms, blended in Karachi. Single ingredients where possible, honest prices, and a label
              you can actually read.
            </span>
            <span className="lang-ur urdu" lang="ur">
              ہربل تیل اور بام، کراچی میں تیار کیے گئے۔ جہاں ممکن ہو سادہ اجزاء، ایماندار قیمتیں، اور ایسا لیبل جسے آپ
              واقعی پڑھ سکیں۔
            </span>
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href="/products"
              className="inline-flex h-13 items-center gap-2 rounded-apo-sm bg-josh px-7.5 font-apo-sans text-[15px] font-medium text-apo-ivory transition-colors hover:bg-apo-ink"
            >
              <span className="lang-en">Shop all products</span>
              <span className="lang-ur urdu" lang="ur">
                تمام پروڈکٹس دیکھیں
              </span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/about" className="font-apo-sans text-[15px] font-medium text-apo-ink underline" style={{ textUnderlineOffset: "5px" }}>
              <span className="lang-en">Our story</span>
              <span className="lang-ur urdu" lang="ur">
                ہماری کہانی
              </span>
            </Link>
          </div>

          <p className="mt-8 border-t border-apo-hairline pt-4 font-apo-sans text-[12.5px] text-apo-muted">
            <span className="lang-en">Cash on delivery · 2–5 day nationwide delivery · Plain packaging</span>
            <span className="lang-ur urdu" lang="ur">
              ڈیلیوری پر ادائیگی · 2 سے 5 دن میں ملک بھر ڈیلیوری · سادہ پیکنگ
            </span>
          </p>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-apo-md border border-apo-panel-border">
          <Image
            src="/hero/range.webp"
            alt="MARK Josh, Rahat and Nazakat herbal oils — three products, one standard of care"
            fill
            priority
            sizes="(min-width: 1280px) 640px, (min-width: 1024px) 50vw, 92vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
