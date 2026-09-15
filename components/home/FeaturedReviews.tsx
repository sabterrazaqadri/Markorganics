import Link from "next/link";
import type { Product, Review } from "@/lib/db/schema";
import { Stars } from "@/components/product/Stars";

/** Up to three approved reviews of the featured product, straight under the hero. */
export function FeaturedReviews({ product, reviews }: { product: Product; reviews: Review[] }) {
  return (
    <section aria-label={`Reviews of ${product.name}`} className="container-x mt-2">
      <ul className="grid gap-3 sm:grid-cols-3">
        {reviews.map((r) => (
          <li key={r.id} className={`card p-4 text-sm ${r.lang === "ur" ? "urdu" : ""}`} lang={r.lang}>
            <div className="flex items-center gap-2">
              <Stars value={r.rating} size={14} />
              {r.isVerified ? <span className="text-xs text-band-care">{r.lang === "ur" ? "تصدیق شدہ خریدار" : "Verified buyer"}</span> : null}
            </div>
            <p className="mt-2 line-clamp-3 text-ink-soft">{r.body}</p>
            <p className="mt-2 font-medium">
              {r.customerName}
              {r.city ? <span className="font-normal text-ink-soft"> · {r.city}</span> : null}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-right text-xs">
        <Link href={`/products/${product.slug}#reviews`} className="underline underline-offset-4">
          All reviews
        </Link>
      </p>
    </section>
  );
}
