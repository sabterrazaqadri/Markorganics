import Link from "next/link";
import Image from "next/image";
import type { ProductWithVariants } from "@/lib/db/schema";
import type { RatingSummary } from "@/lib/reviews";
import { FAMILIES } from "@/lib/catalog";
import { formatPKR } from "@/lib/money";
import { Stars } from "./Stars";

interface Props {
  product: ProductWithVariants;
  priority?: boolean;
  rating?: RatingSummary;
}

export function ProductCard({ product, priority = false, rating }: Props) {
  const fam = FAMILIES[product.family];
  const prices = product.variants.map((v) => v.pricePaisa);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const inStock = product.variants.some((v) => v.stock > 0);
  const image = product.images[0] ?? "/products/placeholder.jpg";
  const compare = product.variants[0]?.compareAtPaisa ?? null;
  const savePct = compare && compare > min && prices.length === 1 ? Math.round(((compare - min) / compare) * 100) : 0;
  const urName = product.i18n?.ur?.name;

  return (
    <article className="card flex flex-col overflow-hidden">
      <Link href={`/products/${product.slug}`} className="group flex flex-1 flex-col" aria-label={`${product.name}, ${inStock ? `from ${formatPKR(min)}` : "sold out"}`}>
        <span className={`band ${fam.band}`} aria-hidden="true" />
        <div className="relative aspect-square bg-white">
          <Image
            src={image}
            alt={`${product.name} bottle`}
            fill
            sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            priority={priority}
          />
          {!inStock ? (
            <span className="absolute left-3 top-3 rounded bg-ink px-2 py-0.5 text-xs font-medium text-white">Sold out</span>
          ) : product.isBundle ? (
            <span className="absolute left-3 top-3 rounded bg-band-care px-2 py-0.5 text-xs font-medium text-white">Kit</span>
          ) : savePct > 0 ? (
            <span className="absolute left-3 top-3 rounded bg-band-care px-2 py-0.5 text-xs font-medium text-white">Save {savePct}%</span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 border-t border-rule p-4">
          <p className={`text-xs font-medium ${fam.text}`}>{product.isBundle ? "Kit" : fam.name}</p>
          <h3 className="text-lg leading-snug">
            {product.name}
            {urName && urName !== product.name ? (
              <span className="lang-ur urdu block text-base font-semibold" lang="ur">
                {urName}
              </span>
            ) : null}
          </h3>
          <p className="text-sm text-ink-soft">{product.shortDescription}</p>
          {rating && rating.count > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-ink-soft">
              <Stars value={rating.average} size={12} />
              <span className="tabular">
                {rating.average.toFixed(1)} ({rating.count})
              </span>
            </p>
          ) : null}
          <p className="tabular mt-auto pt-2 text-sm font-medium">
            {min === max ? formatPKR(min) : `${formatPKR(min)} to ${formatPKR(max)}`}
            {savePct > 0 && compare ? <s className="ml-2 font-normal text-ink-soft">{formatPKR(compare)}</s> : null}
          </p>
        </div>
      </Link>
    </article>
  );
}
