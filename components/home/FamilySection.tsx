import Link from "next/link";
import type { ProductWithVariants } from "@/lib/db/schema";
import { FAMILIES, type Family } from "@/lib/catalog";
import { ProductCard } from "@/components/product/ProductCard";

interface Props {
  family: Family;
  products: ProductWithVariants[];
}

export function FamilySection({ family, products }: Props) {
  const fam = FAMILIES[family];
  return (
    <section aria-labelledby={`family-${family}`} className="mt-4">
      <div className={`band ${fam.band}`} aria-hidden="true" />
      <div className="container-x py-10 md:py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id={`family-${family}`} className="text-3xl sm:text-4xl">
              {fam.heading}
            </h2>
            <p className="mt-2 text-ink-soft">{fam.blurb}</p>
          </div>
          <Link href={`/collections/${family}`} className={`text-sm font-medium underline underline-offset-4 ${fam.text}`}>
            All {fam.name.toLowerCase()}
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
