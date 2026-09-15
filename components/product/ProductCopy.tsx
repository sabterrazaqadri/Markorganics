import type { Product, ProductFaq } from "@/lib/db/schema";
import { Accordion } from "@/components/ui/Accordion";

/** English copy plus the Urdu copy, with English filling any gap. */
export function copyFor(product: Product) {
  const ur = product.i18n?.ur ?? {};
  return {
    en: {
      name: product.name,
      shortDescription: product.shortDescription,
      longDescription: product.longDescription,
      howToUse: product.howToUse,
      ingredients: product.ingredients,
      benefits: product.benefits,
      faqs: product.faqs ?? [],
    },
    ur: {
      name: ur.name ?? product.name,
      shortDescription: ur.shortDescription ?? product.shortDescription,
      longDescription: ur.longDescription ?? product.longDescription,
      howToUse: ur.howToUse?.length ? ur.howToUse : product.howToUse,
      ingredients: ur.ingredients ?? product.ingredients,
      benefits: ur.benefits?.length ? ur.benefits : product.benefits,
      faqs: ur.faqs?.length ? ur.faqs : (product.faqs ?? []),
    },
    hasUrdu: Boolean(ur.shortDescription || ur.longDescription || ur.howToUse?.length),
  };
}

const LABELS = {
  en: { howToUse: "How to use", ingredients: "Ingredients", benefits: "Benefits", faq: "Questions and answers" },
  ur: { howToUse: "استعمال کا طریقہ", ingredients: "اجزاء", benefits: "فوائد", faq: "سوالات اور جوابات" },
};

function AccordionFor({ lang, copy }: { lang: "en" | "ur"; copy: ReturnType<typeof copyFor>["en"] }) {
  const t = LABELS[lang];
  const items = [
    {
      id: `${lang}-how-to-use`,
      title: t.howToUse,
      defaultOpen: true,
      content: (
        <ol className={`list-decimal space-y-1.5 ${lang === "ur" ? "pr-5" : "pl-5"}`}>
          {copy.howToUse.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      ),
    },
    { id: `${lang}-ingredients`, title: t.ingredients, content: <p>{copy.ingredients}</p> },
    {
      id: `${lang}-benefits`,
      title: t.benefits,
      content: (
        <ul className={`list-disc space-y-1.5 ${lang === "ur" ? "pr-5" : "pl-5"}`}>
          {copy.benefits.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ),
    },
  ];
  if (copy.faqs.length) {
    items.push({
      id: `${lang}-faq`,
      title: t.faq,
      content: (
        <dl className="space-y-4">
          {copy.faqs.map((f: ProductFaq, i: number) => (
            <div key={i}>
              <dt className="font-medium text-ink">{f.q}</dt>
              <dd className="mt-1">{f.a}</dd>
            </div>
          ))}
        </dl>
      ),
    });
  }
  return <Accordion items={items} />;
}

/**
 * The descriptive half of the product page in both languages. Both trees are
 * in the HTML; globals.css shows one according to <html data-lang>. The
 * Urdu tree is only emitted when a translation exists.
 */
export function ProductCopy({ product }: { product: Product }) {
  const copy = copyFor(product);
  return (
    <>
      <div className="lang-en">
        <div className="mt-8">
          <h2 className="sr-only">About this product</h2>
          <p className="text-ink-soft">{copy.en.longDescription}</p>
        </div>
        <div className="mt-8">
          <AccordionFor lang="en" copy={copy.en} />
        </div>
      </div>
      {copy.hasUrdu ? (
        <div className="lang-ur urdu" lang="ur" dir="rtl">
          <div className="mt-8">
            <h2 className="sr-only">اس پروڈکٹ کے بارے میں</h2>
            <p className="text-ink-soft">{copy.ur.longDescription}</p>
          </div>
          <div className="mt-8">
            <AccordionFor lang="ur" copy={copy.ur} />
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Title block: the English name is the brand name; the Urdu name and tagline sit under it when present. */
export function ProductIntro({ product, eyebrow, eyebrowClass }: { product: Product; eyebrow: string; eyebrowClass: string }) {
  const copy = copyFor(product);
  return (
    <>
      <p className={`text-sm font-medium ${eyebrowClass}`}>{eyebrow}</p>
      <h1 className="mt-1 text-3xl sm:text-4xl">{product.name}</h1>
      <p className="lang-en mt-3 text-lg text-ink-soft">{copy.en.shortDescription}</p>
      {copy.hasUrdu ? (
        <div className="lang-ur urdu mt-3" lang="ur" dir="rtl">
          {copy.ur.name !== product.name ? <p className="text-xl font-semibold">{copy.ur.name}</p> : null}
          <p className="text-lg text-ink-soft">{copy.ur.shortDescription}</p>
        </div>
      ) : null}
    </>
  );
}
