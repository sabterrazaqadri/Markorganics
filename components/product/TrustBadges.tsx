import { DELIVERY_WINDOW } from "@/config/commerce";
import { DELIVERY_WINDOW_UR } from "@/lib/i18n/checkout";

interface Badge {
  en: string;
  ur: string;
  sub?: { en: string; ur: string };
  icon: React.ReactNode;
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const BADGES: Badge[] = [
  {
    en: "Cash on delivery",
    ur: "ڈیلیوری پر ادائیگی",
    sub: { en: "Rs 0 advance", ur: "پیشگی رقم صفر" },
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...stroke}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M7 12h.01M17 12h.01" />
      </svg>
    ),
  },
  {
    en: "Nationwide delivery",
    ur: "پورے پاکستان میں ڈیلیوری",
    sub: { en: DELIVERY_WINDOW, ur: DELIVERY_WINDOW_UR },
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...stroke}>
        <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
        <circle cx="7" cy="17.5" r="1.5" />
        <circle cx="17" cy="17.5" r="1.5" />
      </svg>
    ),
  },
  {
    en: "7-day easy returns",
    ur: "7 دن میں آسان واپسی",
    sub: { en: "Wrong or damaged? We replace it", ur: "غلط یا خراب؟ ہم بدل دیتے ہیں" },
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...stroke}>
        <path d="M4 10a8 8 0 1 1 2.3 5.7" />
        <path d="M4 4v6h6" />
      </svg>
    ),
  },
  {
    en: "Made in Karachi",
    ur: "کراچی میں تیار",
    sub: { en: "Small batches, label you can read", ur: "چھوٹے بیچ، صاف لیبل" },
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...stroke}>
        <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />
      </svg>
    ),
  },
];

/**
 * The four promises the shop actually keeps, in both languages, plus the
 * payment methods that are switched on in settings. No certification badge
 * appears here that the business cannot show a certificate for.
 */
export function TrustBadges({ paymentMethods, paymentNote }: { paymentMethods: string[]; paymentNote?: string }) {
  return (
    <div className="mt-6 border-t border-rule pt-5">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {BADGES.map((b) => (
          <li key={b.en} className="flex items-start gap-2.5">
            <span className="mt-0.5 text-band-care">{b.icon}</span>
            <span>
              <span className="block font-medium">
                <span className="lang-en">{b.en}</span>
                <span className="lang-ur urdu" lang="ur">
                  {b.ur}
                </span>
              </span>
              {b.sub ? (
                <span className="block text-xs text-ink-soft">
                  <span className="lang-en">{b.sub.en}</span>
                  <span className="lang-ur urdu" lang="ur">
                    {b.sub.ur}
                  </span>
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-soft">
        <span className="lang-en">
          <span className="font-medium text-ink">Payment:</span> {paymentMethods.join(" · ")}
        </span>
        <span className="lang-ur urdu" lang="ur">
          <span className="font-medium text-ink">ادائیگی:</span> {paymentMethods.map(paymentUr).join(" · ")}
        </span>
        {paymentNote ? <span className="block">{paymentNote}</span> : null}
      </p>
    </div>
  );
}

function paymentUr(method: string): string {
  switch (method) {
    case "Cash on delivery":
      return "ڈیلیوری پر نقد";
    case "Bank transfer":
      return "بینک ٹرانسفر";
    default:
      return method;
  }
}
