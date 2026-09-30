export type Family = "oils" | "relief" | "seeds" | "capsules" | "herbal";

export interface FamilyMeta {
  slug: Family;
  name: string;
  heading: string;
  blurb: string;
  /** Solid band background (Tailwind class). */
  band: string;
  /** Accessible text colour for small text on paper/white. */
  text: string;
  border: string;
  hex: string;
}

export const FAMILIES: Record<Family, FamilyMeta> = {
  oils: {
    slug: "oils",
    name: "Oils",
    heading: "Hair and body oils",
    blurb: "Cold-pressed mustard, coconut and onion oils for hair and skin, plus Josh herbal massage oil for men.",
    band: "bg-band-oil",
    text: "text-band-oil-ink",
    border: "border-band-oil",
    hex: "#C1841B",
  },
  relief: {
    slug: "relief",
    name: "Relief",
    heading: "Pain relief",
    blurb: "Menthol and camphor balms for headaches, joint pain and muscle strain.",
    band: "bg-band-care",
    text: "text-band-care",
    border: "border-band-care",
    hex: "#2E6A65",
  },
  seeds: {
    slug: "seeds",
    name: "Seeds",
    heading: "Seeds and superfoods",
    blurb: "Pure chia and flax (alsi) seeds, packed fresh with nothing added.",
    band: "bg-band-seed",
    text: "text-band-seed",
    border: "border-band-seed",
    hex: "#5B6B1E",
  },
  capsules: {
    slug: "capsules",
    name: "Capsules",
    heading: "Herbal capsules",
    blurb: "Ashwagandha, ginseng and moringa in easy daily capsules.",
    band: "bg-band-home",
    text: "text-band-home",
    border: "border-band-home",
    hex: "#2C3C8C",
  },
  herbal: {
    slug: "herbal",
    name: "Herbal",
    heading: "Herbal remedies",
    blurb: "Pure Himalayan shilajit and other traditional herbal remedies.",
    band: "bg-band-herb",
    text: "text-band-herb",
    border: "border-band-herb",
    hex: "#7A3E22",
  },
};

export const FAMILY_ORDER: Family[] = ["oils", "relief", "seeds", "capsules", "herbal"];

export function isFamily(value: string | null | undefined): value is Family {
  return (FAMILY_ORDER as string[]).includes(value ?? "");
}
