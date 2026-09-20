import Link from "next/link";
import type { ProductWithVariants } from "@/lib/db/schema";
import { ProductRangeCard } from "./ProductRangeCard";

const APO_CONTAINER = "mx-auto w-full max-w-[1440px] px-[22px] md:px-12 lg:px-[88px]";

const RANGE: { family: "josh" | "rahat" | "nazakat"; slug: string }[] = [
  { family: "josh", slug: "mark-josh-mens-herbal-oil" },
  { family: "rahat", slug: "mark-rahat-pain-relief-oil" },
  { family: "nazakat", slug: "mark-nazakat-bust-massage-oil" },
];

interface Props {
  products: ProductWithVariants[];
}

/** The curated three-oil range, not the full catalogue — see FamilySection for that. */
export function ProductRange({ products }: Props) {
  const cards = RANGE.map((r) => ({ ...r, product: products.find((p) => p.slug === r.slug) })).filter(
    (r): r is { family: "josh" | "rahat" | "nazakat"; slug: string; product: ProductWithVariants } =>
      r.product != null && r.product.variants.length > 0,
  );
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="range-title" className="bg-apo-ivory">
      <div className={`${APO_CONTAINER} py-14`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-apo-sans text-xs font-medium text-apo-gold-dark" style={{ letterSpacing: "0.22em" }}>
              <span className="lang-en">THE RANGE</span>
              <span className="lang-ur urdu" lang="ur">
                ہماری رینج
              </span>
            </p>
            <h2 id="range-title" className="mt-2 font-apo-display text-[44px] font-normal text-apo-ink">
              <span className="lang-en">Three oils, three colours.</span>
              <span className="lang-ur urdu" lang="ur">
                تین تیل، تین رنگ۔
              </span>
            </h2>
            <p className="mt-2 max-w-[560px] font-apo-sans text-apo-body">
              <span className="lang-en">
                Each family carries its own colour, so the right bottle is easy to find in a dim bathroom or a crowded
                cabinet.
              </span>
              <span className="lang-ur urdu" lang="ur">
                ہر بوتل کا اپنا رنگ ہے، تاکہ دھندلے باتھ روم یا بھری الماری میں صحیح بوتل آسانی سے مل جائے۔
              </span>
            </p>
          </div>
          <Link href="/products" className="font-apo-sans text-sm font-medium text-apo-ink underline" style={{ textUnderlineOffset: "4px" }}>
            <span className="lang-en">All products</span>
            <span className="lang-ur urdu" lang="ur">
              تمام پروڈکٹس
            </span>
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-7 md:grid-cols-3">
          {cards.map((c) => (
            <ProductRangeCard key={c.slug} family={c.family} product={c.product} />
          ))}
        </div>
      </div>
    </section>
  );
}
