import Link from "next/link";
import Image from "next/image";
import type { ComponentLine } from "@/lib/bundles";
import { formatPKR } from "@/lib/money";

/**
 * What ships in a bundle and what the same items cost separately. The saving
 * is computed from live component prices, so it is never a made-up
 * compare-at number.
 */
export function BundleContents({ components, bundlePricePaisa }: { components: ComponentLine[]; bundlePricePaisa: number }) {
  const listPrice = components.reduce((n, c) => n + c.pricePaisa * c.quantity, 0);
  const saving = Math.max(0, listPrice - bundlePricePaisa);
  const pct = listPrice > 0 ? Math.round((saving / listPrice) * 100) : 0;

  return (
    <section aria-labelledby="bundle-title" className="card mt-6 p-4">
      <h2 id="bundle-title" className="text-base">
        <span className="lang-en">What is in the kit</span>
        <span className="lang-ur urdu" lang="ur">
          کٹ میں کیا شامل ہے
        </span>
      </h2>
      <ul className="mt-3 divide-y divide-rule">
        {components.map((c) => (
          <li key={c.componentVariantId} className="flex items-center gap-3 py-2.5 text-sm">
            {c.image ? (
              <Image src={c.image} alt="" width={48} height={48} sizes="48px" className="h-12 w-12 rounded border border-rule bg-white object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <Link href={`/products/${c.productSlug}`} className="font-medium hover:underline underline-offset-4">
                {c.productName}
              </Link>
              <p className="text-ink-soft">
                {c.label}
                {c.quantity > 1 ? ` × ${c.quantity}` : ""}
              </p>
            </div>
            <p className="tabular text-ink-soft">{formatPKR(c.pricePaisa * c.quantity)}</p>
          </li>
        ))}
      </ul>
      {saving > 0 ? (
        <p className="mt-3 border-t border-rule pt-3 text-sm">
          <span className="lang-en">
            Separately {formatPKR(listPrice)}. In the kit {formatPKR(bundlePricePaisa)}:{" "}
            <span className="font-medium text-band-care">you save {formatPKR(saving)} ({pct}%)</span>.
          </span>
          <span className="lang-ur urdu" lang="ur">
            الگ الگ {formatPKR(listPrice)}۔ کٹ میں {formatPKR(bundlePricePaisa)}:{" "}
            <span className="font-medium text-band-care">
              آپ کی بچت {formatPKR(saving)} ({pct}%)
            </span>
            ۔
          </span>
        </p>
      ) : null}
    </section>
  );
}
