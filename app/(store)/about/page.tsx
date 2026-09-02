import type { Metadata } from "next";
import Link from "next/link";
import { FAMILIES, FAMILY_ORDER } from "@/lib/catalog";
import { PageBody, pageMetadata } from "@/components/content/PageBody";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("about", {
    title: "About",
    description:
      "MARKORGANICS makes everyday oils, balms and laundry blue for Pakistani homes. Honest ingredients, honest prices.",
  });
}

export default function AboutPage() {
  return (
    <PageBody slug="about" fallbackTitle="About MARKORGANICS">
      <p>
        MARKORGANICS is a small Karachi company that makes the products a household actually uses every week: hair oil,
        a balm for headaches and sore muscles, and neel for the laundry. Nothing on this site is a luxury item, and none
        of it is priced like one.
      </p>
      <h2>How we make things</h2>
      <p>
        The oils are cold-pressed in small batches and filtered, not refined. The balms follow formulas that have been
        used in Pakistani homes for decades. The neel is a liquid so it mixes properly. Where a product can be a single
        ingredient, it is.
      </p>
      <h2>The colour bands</h2>
      <p>Every product family has a colour band printed across the label, the same way the band runs across this site.</p>
      <ul>
        {FAMILY_ORDER.map((f) => (
          <li key={f}>
            <span className={`mr-2 inline-block h-3 w-6 align-middle ${FAMILIES[f].band}`} aria-hidden="true" />
            <strong>{FAMILIES[f].name}</strong>: {FAMILIES[f].heading.toLowerCase()}
          </li>
        ))}
      </ul>
      <h2>How we sell</h2>
      <p>
        Cash on delivery only, anywhere in Pakistan. We call every customer before dispatch. If a product arrives
        damaged or wrong, we replace it. Read the full <Link href="/shipping-returns">delivery and returns policy</Link>.
      </p>
    </PageBody>
  );
}
