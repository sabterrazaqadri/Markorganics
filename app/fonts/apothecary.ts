import { Fraunces, Work_Sans, Noto_Nastaliq_Urdu } from "next/font/google";

// Homepage hero + product-range only. The rest of the site keeps Archivo /
// Inter Tight (app/layout.tsx) — apply `apothecaryFontVars` on a wrapping
// element rather than <html> so these stay scoped to that section.

export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-fraunces",
  fallback: ["Georgia", "serif"],
});

export const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-work-sans",
  fallback: ["system-ui", "sans-serif"],
});

export const nastaliqApo = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["500"],
  display: "swap",
  variable: "--font-nastaliq-apo",
  fallback: ["Noto Nastaliq Urdu", "serif"],
});

export const apothecaryFontVars = `${fraunces.variable} ${workSans.variable} ${nastaliqApo.variable}`;
