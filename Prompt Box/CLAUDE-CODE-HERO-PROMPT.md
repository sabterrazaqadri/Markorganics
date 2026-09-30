# Claude Code — Build Prompt: MARKORGANIC Homepage Hero

> Copy everything below the line into Claude Code.

---

Build the homepage hero and product-range section for **MARKORGANIC**, a Karachi-based herbal oils and balms brand. This replaces the current homepage, which incorrectly shows a single product's PDP layout (price, discount badge, Add to cart, image thumbnails) in the hero slot.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- `next/font/google` for fonts
- No UI component library. Write the markup directly.
- Server components by default; add `'use client'` only where an interaction actually needs it.

If the repo already has conventions (path aliases, a `cn()` helper, an existing `Container` or `Section` primitive), follow them instead of inventing new ones. Inspect the repo before writing.

## Design intent

The homepage hero sells **the brand**, not one product. It answers "what is this company and where do I go next" — it does not answer "how do I buy this bottle." Nothing that belongs on a product detail page goes in the hero.

The feel is **apothecary**: warm ivory ground, generous whitespace, one confident serif headline, restrained gold accents, sharp 2–3px corner radii (not rounded cards). It should read as a considered small brand, not a marketplace listing.

## Design tokens

Add these to the Tailwind theme (extend, don't replace) as semantic names.

```
Ground / ivory        #FBF7EE
Surface (cards)       #FFFDF8
Panel (tinted)        #F4ECDC
Ink (primary text)    #171310
Body text             #5E564A
Muted text            #6B6255
Hairline / border     #E3DACA
Panel border          #E6DCC7
Gold (eyebrow, caps)  #A8813C
Gold dark (text)      #8A6C2E

Product families:
  Josh    — deep green   #1E4433   · tint bg #EAEFE9 · text-on-ivory #1E4433
  Rahat   — burnt amber  #B4531A   · tint bg #F6E9DC · text-on-ivory #96461A
  Nazakat — deep rose    #A63B58   · tint bg #F7E7EC · text-on-ivory #8A2F49
```

Corner radius: `2px` for buttons and inputs, `3px` for cards and panels. Nothing more.

Never use the raw hex in JSX. Define the tokens once and reference them by name.

## Fonts

```ts
import { Fraunces, Work_Sans, Noto_Nastaliq_Urdu } from 'next/font/google';
```

- **Fraunces** — display. Headlines, product names, brand wordmark. Weights 400 and 600. Use the variable `opsz` axis if straightforward.
- **Work Sans** — body and UI. Weights 400, 500, 600.
- **Noto Nastaliq Urdu** — weight 500, for Urdu product names only (جوش، راحت، نزاکت) and the language toggle.

Expose all three as CSS variables on `<html>` and map them to `font-display`, `font-sans`, `font-urdu` in the Tailwind theme. Set `display: 'swap'` and give each a sensible fallback stack.

Nastaliq needs extra line-height — Urdu names need roughly `leading-[1.9]` or they clip.

## Components to build

```
components/
  layout/SiteHeader.tsx
  home/Hero.tsx
  home/ProductRange.tsx
  home/ProductCard.tsx
  home/TrustStrip.tsx
  brand/BottleMark.tsx      // placeholder product illustration
  brand/Wordmark.tsx
```

Compose them in `app/page.tsx`.

---

### 1. `SiteHeader`

Sticky, ivory background, single `1px` hairline bottom border, height `76px` desktop / `60px` mobile.

- **Left:** `Wordmark` — three 4×20px vertical bars (gold, Josh green, Nazakat rose) with a 2px gap, then "MARKORGANIC" in Fraunces 600, 19px, slight positive tracking.
- **Centre (desktop only, ≥1024px):** nav links — Oils · Relief · Home · Journal · Track order. 14px, body-text colour, ink on hover, no underline at rest.
- **Right:** an EN / اردو segmented toggle (1px border, active segment filled ink with ivory text) and a Cart button — ink fill, ivory text, inline stroke SVG cart icon, 13px.
- **Below 1024px:** nav collapses to a hamburger button. The button must be a real `<button type="button">` with `aria-label` and a ≥44px hit area. A working drawer is optional — a non-functional trigger is acceptable for now, but say so in a comment.

### 2. `Hero`

Two columns on desktop, stacked on mobile.

**Left column — fixed `560px` at ≥1280px, fluid below:**

| Element | Spec |
|---|---|
| Eyebrow | `MARKORGANIC · KARACHI` — 12px, tracking `0.22em`, weight 500, gold-dark |
| H1 | Fraunces 400, **70px** desktop / 38px mobile, `leading-[1.03]`, tracking `-0.02em` |
| Sub | 18px, `leading-[1.62]`, body-text colour, `max-w-[470px]` |
| CTA row | one primary + one text link |
| Trust line | above a `1px` top hairline, 12.5px, muted, `·` separators |

**Exact copy — use verbatim:**

- H1: `Made for the shelf,` / line break / `not the shop window.`
  The break is intentional. Use a `<br />` at ≥1280px and let it wrap naturally below.
- Sub: `Herbal oils and balms, blended in Karachi. Single ingredients where possible, honest prices, and a label you can actually read.`
- Primary CTA: `Shop all products` with a trailing arrow icon → links to `/products`
- Secondary: `Our story` → `/about`
- Trust line: `Cash on delivery · 2–5 day nationwide delivery · Plain packaging`

Primary CTA: Josh-green fill, ivory text, `52px` tall, `30px` horizontal padding, `2px` radius, inline stroke-SVG arrow. Secondary is a plain underlined link with `text-underline-offset: 5px`. **Two equally weighted solid buttons is the failure mode — do not do it.**

**Right column — fills remaining width, `626px` tall:**

A tinted panel (`Panel` bg, `1px` panel border, `3px` radius) containing the three bottles standing on a baseline, `44px` gap, bottom-aligned. Josh is the centre and tallest (`132×352`); Nazakat and Rahat flank it at `112×300`. Under each bottle, its name in 11px with `0.16em` tracking in that family's on-ivory colour.

A hairline rule sits across the bottom of the panel with the line `Three oils. One standard.` centred in Fraunces 15px.

Below `1024px` the panel moves under the copy and the bottles shrink to roughly 74/88/74 wide.

### 3. `BottleMark`

Props: `family: 'josh' | 'rahat' | 'nazakat'`, `width`, `height`, and an optional `showUrdu`.

Render an inline SVG on `viewBox="0 0 120 320"`:

```
body      rect x=24 y=80 w=72 h=232 rx=12      family colour
shoulder  path M44 46 L76 46 L92 86 L28 86 Z   family colour
neck      rect x=46 y=40 w=28 h=14             family colour
cap       rect x=42 y=8  w=36 h=36 rx=5        #A8813C
cap lip   rect x=42 y=38 w=36 h=6              #8B6829
highlight rect x=33 y=100 w=7 h=186 rx=3.5     #FFFFFF at 0.16 opacity
label     rect x=32 y=158 w=56 h=106 rx=3      #F9F3E6
```

Then SVG `<text>` centred at x=60: the Latin name (Fraunces 600, ~15–17px, family colour), the Urdu name below it (Nastaliq 12px), and `15 ML` (Work Sans 7px, `1.4` letter-spacing, `#8A8072`).

Give the SVG `role="img"` and an `aria-label` naming the product.

**This is a placeholder.** Add a clear comment at the top of the file:

```
// PLACEHOLDER — replace with real product photography.
// Requirements for the shoot: plain surface, single side light,
// no text, badges or icons inside the image file.
```

### 4. `ProductRange` + `ProductCard`

Section header on the left — eyebrow `THE RANGE`, H2 `Three oils, three colours.` (Fraunces 400, 44px), and a sub line: `Each family carries its own colour, so the right bottle is easy to find in a dim bathroom or a crowded cabinet.` On the right, an `All products` link.

Then a 3-column grid (`gap-7`), collapsing to 1 column below `768px`.

Each `ProductCard`:
- Top: `296px` tall block in the family's tint colour, bottle bottom-aligned with `26px` bottom padding
- Body: category eyebrow (11px, `0.18em` tracking, family colour) → name row (Fraunces 600 28px + Urdu name in Nastaliq 17px, baseline-aligned) → description (14.5px, `leading-[1.55]`) → a price/link row pushed to the bottom
- `1px` hairline border, `3px` radius, `Surface` background

**Product data — put it in `lib/products.ts` as a typed array, do not hardcode in JSX:**

| | Josh | Rahat | Nazakat |
|---|---|---|---|
| Urdu | جوش | راحت | نزاکت |
| Category | MASSAGE OIL | JOINT & MUSCLE | BODY CARE |
| Description | Warming herbal massage oil for men — pellitory root, clove, argan and egg oil. | Herbal massage oil for joints and muscles — eucalyptus, clove, pellitory root and argan. | Nourishing bust massage oil — almond, kalonji, jojoba, rosehip and vitamin E. |
| Price | Rs 1,850 | Rs 1,499 | `[YOUR PRICE]` |
| Size | 15 ml | 15 ml | 15 ml |
| Slug | `/products/josh` | `/products/rahat` | `/products/nazakat` |

Nazakat's price is genuinely unknown — render the literal placeholder `[YOUR PRICE]`. Do not invent a number.

### 5. `TrustStrip`

Three columns above a top hairline, each a bold label and a muted line:

- `Cash on delivery` / `No card, no advance. Pay the rider.`
- `Nationwide delivery` / `2 to 5 working days. Free above Rs 2,000.`
- `Plain packaging` / `Nothing printed on the outer box.`

Stacks to one column below `768px`.

## Responsive

Breakpoints: `<768` mobile, `768–1023` tablet, `1024–1279` small desktop, `≥1280` full. Page gutters: `22px` mobile, `48px` tablet, `88px` at `≥1280`. Cap the content at `1440px` and centre it.

## Accessibility — non-negotiable

- Real `<a href>` and `<button type="button">`. Never `onClick` on a `div` or `span`.
- One `<h1>` on the page. Section headings are `<h2>`, card titles `<h3>`.
- `aria-label` on every icon-only control; `aria-hidden="true"` on decorative SVGs.
- Body text must hit 4.5:1 against its background (large text 3:1). Verify the muted greys — `#6B6255` on `#FBF7EE` passes, anything lighter does not.
- Visible focus rings. Do not remove outlines without replacing them.
- Wrap Urdu text in `<span lang="ur" dir="rtl">`.

## Do not

- Do not put price, strikethrough price, discount badges, Add to cart, size selectors, or image thumbnails anywhere in the hero. They belong on the PDP.
- Do not use gradient backgrounds, drop shadows on cards, emoji, or left-border accent cards.
- Do not use Inter, Roboto, or Arial.
- Do not add animation libraries. A CSS `transition-colors` on hover is enough.
- Do not install any new dependency without asking first.
- Do not invent copy, statistics, testimonials, or review counts. Anything unknown becomes a bracketed placeholder.
- Do not bake text into image files.

## Done when

1. `npm run build` passes with no TypeScript errors.
2. The page renders correctly at 390, 768, 1024, 1280 and 1440px with no horizontal scroll.
3. Fonts load through `next/font` — no render-blocking `<link>` to Google Fonts in the markup.
4. Keyboard tab order runs header → hero CTAs → product cards → trust strip, with a visible focus ring at every stop.
5. Every colour comes from a named token; no raw hex in JSX.
6. Product data lives in `lib/products.ts`.

Start by inspecting the existing repo structure and telling me what you found and what you plan to change, before writing any code.
