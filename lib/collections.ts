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
  seeds: {
    title: "Chia seeds and flax seeds (alsi), pure and unprocessed",
    description:
      "MARK Chia Seeds and MARK Flax Seeds (alsi): pure, unprocessed and packed fresh. Fibre, omega-3 and plant protein for every day. Cash on delivery across Pakistan.",
    heading: "Seeds and superfoods",
    standfirst: "Small seeds that do a lot, packed pure with nothing added.",
    body: [
      "Chia and flax are two of the easiest ways to add fibre, plant omega-3 and protein to an ordinary Pakistani breakfast. Chia swells into a soft gel in water or milk and keeps you full for hours. Flax, alsi, is best ground and stirred into oats, yogurt, lassi or roti dough, and it is what goes into winter pinni.",
      "Both are sold exactly as they come: no roasting, no coating, no preservatives. Start with a tablespoon a day, soak chia before you eat it, grind flax just before you use it, and drink plenty of water with either.",
    ],
    ogLine: "Chia and flax (alsi) seeds",
  },
  capsules: {
    title: "Herbal capsules: ashwagandha, ginseng and moringa",
    description:
      "MARK Ashwagandha, Ginseng and Moringa capsules: pure herbs in an easy daily dose for calm, energy, focus and immunity. Cash on delivery across Pakistan.",
    heading: "Herbal capsules",
    standfirst: "Traditional herbs in a measured daily capsule, without the bitter powder.",
    body: [
      "Ashwagandha is the herb for stress and sleep, ginseng for steady energy and focus, and moringa for everyday nutrition and immunity. Each is filled from the pure root or leaf, so the dose is the same every day and there is nothing to measure or mix.",
      "Herbs work slowly. Take them after a meal and give them three to four weeks. If you are pregnant or breastfeeding, have a medical condition or take regular medicine, ask your doctor first. None of these capsules is a medicine; read our medical disclaimer.",
    ],
    ogLine: "Ashwagandha, ginseng and moringa",
  },
  herbal: {
    title: "Pure Himalayan shilajit and herbal remedies",
    description:
      "MARK Pure Shilajit Resin: 100% Himalayan salajeet for energy, stamina and strength, from 20g to 100g jars. Cash on delivery across Pakistan.",
    heading: "Herbal remedies",
    standfirst: "Old remedies, sourced carefully and sold pure.",
    body: [
      "Shilajit, salajeet, is a mineral-rich resin from high Himalayan rock that has been used for centuries for energy, stamina and strength. Ours is pure resin with nothing added. A pea-sized amount dissolved in warm water or milk each morning is a full serving, so even the smallest jar lasts weeks.",
      "Real resin is firm in the cold and sticky in the heat; that is how you know it is not a powder or a pill. Avoid it in pregnancy, and talk to a doctor first if you have a heart condition, high blood pressure or gout.",
    ],
    ogLine: "Pure Himalayan shilajit",
  },
};
