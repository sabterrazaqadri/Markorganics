import Link from "next/link";
import Image from "next/image";
import type { ProductWithVariants } from "@/lib/db/schema";
import { FAMILIES } from "@/lib/catalog";
import { formatPKR } from "@/lib/money";

interface Props {
  product: ProductWithVariants;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: Props) {
  const fam = FAMILIES[product.family];
  const prices = product.variants.map((v) => v.pricePaisa);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const inStock = product.variants.some((v) => v.stock > 0);
  const image = product.images[0] ?? "/products/placeholder.jpg";

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
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 border-t border-rule p-4">
          <p className={`text-xs font-medium ${fam.text}`}>{fam.name}</p>
          <h3 className="text-lg leading-snug">{product.name}</h3>
          <p className="text-sm text-ink-soft">{product.shortDescription}</p>
          <p className="tabular mt-auto pt-2 text-sm font-medium">
            {min === max ? formatPKR(min) : `${formatPKR(min)} to ${formatPKR(max)}`}
          </p>
        </div>
      </Link>
    </article>
  );
}
