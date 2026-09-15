import type { Family } from "@/lib/catalog";

/**
 * Landing-page copy for /collections/[family]. Written per family rather than
 * templated, because these are real entry points from search and ads.
 */
export interface CollectionCopy {
  /** <title> and OG title. */
  title: string;
  /** Meta description, kept near 155 characters. */
  description: string;
  /** Page h1. */
  heading: string;
  /** One-line standfirst under the h1. */
  standfirst: string;
  /** Body paragraphs shown under the standfirst. */
  body: string[];
  /** Short line for the OG image. */
  ogLine: string;
}

export const COLLECTIONS: Record<Family, CollectionCopy> = {
  oils: {
    title: "Hair and body oils, cold-pressed and unrefined",
    description:
      "Mustard, coconut and onion oils pressed cold and bottled without bleaching or blending. For hair fall, dry scalp and winter skin. Cash on delivery across Pakistan.",
    heading: "Hair and body oils",
    standfirst: "Four oils, pressed cold and bottled the way they came out of the press.",
    body: [
      "Most oil sold by weight in Pakistan has been heated, bleached and cut with something cheaper. Ours is not. Mustard seed is pressed cold so it keeps the sharp smell people recognise, coconut is filtered twice so it pours clear in winter, and the onion blend is rested a fortnight so the sulphur compounds actually move into the oil.",
      "Use mustard oil weekly on the scalp for hair fall and dryness. Use coconut on damp ends and on skin straight after a bath. Use onion oil two or three times a week where hair has thinned. Josh is a separate thing entirely, a warming herbal massage oil for men.",
    ],
    ogLine: "Mustard, coconut and onion oils",
  },
  relief: {
    title: "Pain relief balm and deep heat rub",
    description:
      "MARK Balm for headaches, colds and tight muscles. MARK Iodex for backache, joint pain and sprains. Menthol and camphor, honestly priced. Cash on delivery across Pakistan.",
    heading: "Pain relief",
    standfirst: "The tin in the drawer and the rub for the bad knee.",
    body: [
      "MARK Balm is built around menthol and camphor in a firm wax base that does not melt in a Karachi summer. It is what you reach for at the end of a long day: rubbed on the temples for a tension headache, on the chest for a blocked nose, into the shoulders after sitting badly for hours.",
      "MARK Iodex goes deeper. Methyl salicylate and turpentine oil raise blood flow to a joint rather than just cooling the skin above it, which is what you want for a lower back, a knee or a sprain. Use a small amount, wash your hands after, and keep both away from the eyes.",
    ],
    ogLine: "Balm and deep heat rub",
  },
  home: {
    title: "Liquid neel that whitens without blue patches",
    description:
      "MARK Liquid Neel dissolves fully in the rinse water, so shirts and sheets come back white with no spotting. One capful per bucket. Cash on delivery across Pakistan.",
    heading: "Laundry and home",
    standfirst: "Neel that mixes properly, so whites come back white and not blotchy.",
    body: [
      "Powder neel has one persistent problem: it never fully dissolves. Undissolved grains settle on wet cotton and leave the blue spots that ruin a good shirt. Making it a liquid solves that at the source, because it disperses evenly through the rinse water before the cloth ever goes in.",
      "A single capful is enough for a full bucket, so one bottle covers weeks of washing. It is safe on cotton, linen and blends, and works by hand or in a machine rinse cycle. There is no bleach in it, so it whitens without weakening the fabric.",
    ],
    ogLine: "Liquid laundry blue",
  },
};
