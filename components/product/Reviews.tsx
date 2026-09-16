import type { Review } from "@/lib/db/schema";
import type { RatingSummary } from "@/lib/reviews";
import { Stars } from "./Stars";
import { ReviewForm } from "./ReviewForm";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });

/**
 * Approved reviews and the rating breakdown. Server-rendered so every review
 * is in the HTML for crawlers; the competitor's JavaScript-only widget is
 * invisible to Google and this is not.
 */
export function Reviews({ productSlug, summary, reviews }: { productSlug: string; summary: RatingSummary; reviews: Review[] }) {
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="mt-16 border-t border-rule pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="reviews-title" className="text-2xl sm:text-3xl">
            <span className="lang-en">Customer reviews</span>
            <span className="lang-ur urdu" lang="ur">
              گاہکوں کی رائے
            </span>
          </h2>
          {summary.count > 0 ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
              <Stars value={summary.average} size={18} />
              <span className="tabular font-medium text-ink">{summary.average.toFixed(1)}</span>
              <span>
                <span className="lang-en">
                  from {summary.count} review{summary.count === 1 ? "" : "s"}
                </span>
                <span className="lang-ur urdu" lang="ur">
                  {summary.count} آراء کی بنیاد پر
                </span>
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              <span className="lang-en">No reviews yet. Yours would be the first.</span>
              <span className="lang-ur urdu" lang="ur">
                ابھی کوئی رائے نہیں۔ آپ کی رائے پہلی ہوگی۔
              </span>
            </p>
          )}
        </div>
        {summary.count > 0 ? (
          <dl className="w-full max-w-xs space-y-1 text-xs" aria-label="Rating breakdown">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = summary.distribution[star - 1];
              const pct = summary.count ? Math.round((n / summary.count) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <dt className="w-8 tabular text-ink-soft">{star}★</dt>
                  <dd className="flex flex-1 items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded bg-rule">
                      <span className="block h-full bg-band-oil" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-6 tabular text-right text-ink-soft">{n}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="space-y-6">
          {reviews.map((r) => (
            <li key={r.id} className={`border-b border-rule pb-6 ${r.lang === "ur" ? "urdu" : ""}`} lang={r.lang}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={r.rating} size={14} />
                <span className="font-medium">{r.customerName}</span>
                {r.city ? <span className="text-sm text-ink-soft">{r.city}</span> : null}
                {r.isVerified ? (
                  <span className="rounded border border-band-care/40 px-1.5 py-0.5 text-xs text-band-care">
                    {r.lang === "ur" ? "تصدیق شدہ خریدار" : "Verified buyer"}
                  </span>
                ) : null}
                <time dateTime={r.createdAt.toISOString()} className="text-xs text-ink-soft">
                  {DAY.format(r.createdAt)}
                </time>
              </div>
              {r.title ? <p className="mt-2 font-display font-semibold">{r.title}</p> : null}
              <p className="mt-1 whitespace-pre-line text-ink-soft">{r.body}</p>
              {r.reply ? (
                <div className="mt-3 border-l-2 border-band-oil pl-3 text-sm">
                  <p className="font-medium">{r.lang === "ur" ? "مارک آرگینک کا جواب" : "Reply from MARKORGANIC"}</p>
                  <p className="text-ink-soft">{r.reply}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <div>
          <ReviewForm productSlug={productSlug} />
        </div>
      </div>
    </section>
  );
}
