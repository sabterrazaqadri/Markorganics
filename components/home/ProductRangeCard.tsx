import Link from "next/link";
import Image from "next/image";
import type { ProductWithVariants } from "@/lib/db/schema";
import { formatPKR } from "@/lib/money";
import { BottleMark } from "@/components/brand/BottleMark";

type Family = "josh" | "rahat" | "nazakat";

const CATEGORY: Record<Family, { en: string; ur: string }> = {
  josh: { en: "MASSAGE OIL", ur: "مساج آئل" },
  rahat: { en: "JOINT & MUSCLE", ur: "جوڑ اور پٹھے" },
  nazakat: { en: "BODY CARE", ur: "باڈی کیئر" },
};

const CATEGORY_TEXT: Record<Family, string> = {
  josh: "text-josh",
  rahat: "text-rahat-ink",
  nazakat: "text-nazakat-ink",
};

const TINT_BG: Record<Family, string> = {
  josh: "bg-josh-tint",
  rahat: "bg-rahat-tint",
  nazakat: "bg-nazakat-tint",
};

const URDU_NAME: Record<Family, string> = { josh: "جوش", rahat: "راحت", nazakat: "نزاکت" };

interface Props {
  family: Family;
  product: ProductWithVariants;
}

export function ProductRangeCard({ family, product }: Props) {
  const variant = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const image = product.images[0];
  const category = CATEGORY[family];

  return (
    <div className="rounded-apo-md border border-apo-hairline bg-apo-surface">
      <div className={`flex h-[296px] items-end justify-center rounded-t-apo-md pb-[26px] ${TINT_BG[family]}`}>
        {image ? (
          <div className="relative h-full w-full">
            <Image src={image} alt={product.name} fill sizes="(min-width: 768px) 33vw, 92vw" className="object-contain object-bottom" />
          </div>
        ) : (
          <BottleMark family={family} width={90} height={240} />
        )}
      </div>

      <div className="p-6">
        <p className={`font-apo-sans text-[11px] font-medium ${CATEGORY_TEXT[family]}`} style={{ letterSpacing: "0.18em" }}>
          <span className="lang-en">{category.en}</span>
          <span className="lang-ur urdu" lang="ur">
            {category.ur}
          </span>
        </p>

        <div className="mt-2 flex items-baseline gap-3">
          <h3 className="font-apo-display text-[28px] font-semibold text-apo-ink">{product.name.replace(/^MARK\s+/i, "")}</h3>
          <span className="urdu font-apo-urdu text-[17px] text-apo-ink" lang="ur">
            {URDU_NAME[family]}
          </span>
        </div>

        <p className="mt-2 font-apo-sans text-[14.5px] text-apo-body" style={{ lineHeight: 1.55 }}>
          <span className="lang-en">{product.shortDescription}</span>
          <span className="lang-ur urdu" lang="ur">
            {product.i18n?.ur?.shortDescription ?? product.shortDescription}
          </span>
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-apo-hairline pt-4">
          <div className="flex items-baseline gap-2">
            <span className="tabular font-apo-sans text-lg font-semibold text-apo-ink">{formatPKR(variant.pricePaisa)}</span>
            {variant.compareAtPaisa && variant.compareAtPaisa > variant.pricePaisa ? (
              <s className="tabular font-apo-sans text-sm text-apo-muted">{formatPKR(variant.compareAtPaisa)}</s>
            ) : null}
          </div>
          <Link href={`/products/${product.slug}`} className="font-apo-sans text-sm font-medium text-apo-ink underline" style={{ textUnderlineOffset: "4px" }}>
            <span className="lang-en">View</span>
            <span className="lang-ur urdu" lang="ur">
              دیکھیں
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
