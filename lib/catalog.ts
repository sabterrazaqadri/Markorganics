export type Family = "oils" | "relief" | "home";

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
    blurb: "Cold-pressed mustard, coconut and onion oils for hair and skin, plus Desire Drop for adults.",
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
  home: {
    slug: "home",
    name: "Home",
    heading: "Laundry and home",
    blurb: "Liquid neel that keeps whites white without stains or clumps.",
    band: "bg-band-home",
    text: "text-band-home",
    border: "border-band-home",
    hex: "#2C3C8C",
  },
};

export const FAMILY_ORDER: Family[] = ["oils", "relief", "home"];

export function isFamily(value: string | null | undefined): value is Family {
  return value === "oils" || value === "relief" || value === "home";
}
