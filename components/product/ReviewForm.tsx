"use client";

import { useState, useTransition, type FormEvent } from "react";
import { submitReviewAction } from "@/app/(store)/products/[slug]/actions";
import { reviewInputSchema, type ReviewInput } from "@/lib/validation/review";
import { useLang } from "@/store/lang";

const COPY = {
  en: {
    heading: "Write a review",
    intro: "Used it? Tell the next customer. Reviews go live after a quick check by our team.",
    rating: "Your rating",
    name: "Your name",
    city: "City (optional)",
    phone: "Mobile number (optional)",
    phoneHint: "Only used to mark your review as a verified purchase. Never shown.",
    title: "Title (optional)",
    body: "Your review",
    submit: "Send review",
    sending: "Sending",
    thanksVerified: "Thank you. Your review is marked as a verified purchase and will appear after a quick check.",
    thanks: "Thank you. Your review will appear after a quick check by our team.",
    star: (n: number) => `${n} star${n === 1 ? "" : "s"}`,
  },
  ur: {
    heading: "اپنی رائے لکھیں",
    intro: "استعمال کیا؟ اگلے گاہک کو بتائیں۔ ہماری ٹیم کی جانچ کے بعد رائے شائع ہوتی ہے۔",
    rating: "آپ کی ریٹنگ",
    name: "آپ کا نام",
    city: "شہر (اختیاری)",
    phone: "موبائل نمبر (اختیاری)",
    phoneHint: "صرف تصدیق شدہ خریداری کے نشان کے لیے۔ کبھی ظاہر نہیں ہوتا۔",
    title: "عنوان (اختیاری)",
    body: "آپ کی رائے",
    submit: "رائے بھیجیں",
    sending: "بھیجا جا رہا ہے",
    thanksVerified: "شکریہ۔ آپ کی رائے تصدیق شدہ خریداری کے طور پر جانچ کے بعد شائع ہوگی۔",
    thanks: "شکریہ۔ ہماری ٹیم کی جانچ کے بعد آپ کی رائے شائع ہوگی۔",
    star: (n: number) => `${n} ستارے`,
  },
};

export function ReviewForm({ productSlug }: { productSlug: string }) {
  const lang = useLang((s) => s.lang);
  const t = COPY[lang];
  const [form, setForm] = useState({ name: "", city: "", phone: "", title: "", body: "", rating: 0, website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const input: ReviewInput = { ...form, productSlug, lang, rating: form.rating };
    const parsed = reviewInputSchema.safeParse(input);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "_");
        if (!fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      return;
    }
    start(async () => {
      const result = await submitReviewAction(input);
      if (result.ok) {
        setDone(result.verified ? t.thanksVerified : t.thanks);
        return;
      }
      if (result.fieldErrors) setErrors(result.fieldErrors);
      setMessage(result.message);
    });
  }

  if (done) {
    return (
      <p role="status" className={`card border-band-care/40 p-4 text-sm text-band-care ${lang === "ur" ? "urdu" : ""}`}>
        {done}
      </p>
    );
  }

  const dir = lang === "ur" ? "urdu" : "";

  return (
    <form onSubmit={onSubmit} noValidate className={`card space-y-4 p-5 ${dir}`} lang={lang}>
      <div>
        <h3 className="text-lg">{t.heading}</h3>
        <p className="mt-1 text-sm text-ink-soft">{t.intro}</p>
      </div>
      {message ? (
        <p role="alert" className="rounded border border-danger/40 bg-white px-3 py-2 text-sm text-danger">
          {message}
        </p>
      ) : null}

      <fieldset>
        <legend className="label">{t.rating}</legend>
        <div role="radiogroup" aria-label={t.rating} className="flex gap-1" dir="ltr">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={form.rating === n}
              aria-label={t.star(n)}
              onClick={() => set("rating", n)}
              className="p-1 text-2xl leading-none"
            >
              <span aria-hidden="true" className={n <= form.rating ? "text-band-oil" : "text-rule"}>
                ★
              </span>
            </button>
          ))}
        </div>
        {errors.rating ? <p className="mt-1 text-sm text-danger">{errors.rating}</p> : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rv-name" className="label">
            {t.name}
          </label>
          <input id="rv-name" className="field" value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={errors.name ? "true" : undefined} />
          {errors.name ? <p className="mt-1 text-sm text-danger">{errors.name}</p> : null}
        </div>
        <div>
          <label htmlFor="rv-city" className="label">
            {t.city}
          </label>
          <input id="rv-city" className="field" value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="rv-phone" className="label">
          {t.phone}
        </label>
        <input
          id="rv-phone"
          className="field"
          type="tel"
          inputMode="tel"
          placeholder="0300 1234567"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          aria-invalid={errors.phone ? "true" : undefined}
          aria-describedby="rv-phone-hint"
        />
        {errors.phone ? (
          <p className="mt-1 text-sm text-danger">{errors.phone}</p>
        ) : (
          <p id="rv-phone-hint" className="mt-1 text-xs text-ink-soft">
            {t.phoneHint}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="rv-title" className="label">
          {t.title}
        </label>
        <input id="rv-title" className="field" maxLength={80} value={form.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div>
        <label htmlFor="rv-body" className="label">
          {t.body}
        </label>
        <textarea
          id="rv-body"
          className="field min-h-28"
          maxLength={1500}
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
          aria-invalid={errors.body ? "true" : undefined}
        />
        {errors.body ? <p className="mt-1 text-sm text-danger">{errors.body}</p> : null}
      </div>
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="rv-website">Website</label>
        <input id="rv-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? t.sending : t.submit}
      </button>
    </form>
  );
}
