# MARK — Claude Code Build Prompt (one-shot)

Build a complete, production-ready e-commerce storefront for **MARKORGANICS**, a Pakistani consumer brand selling hair/body/adult oils, pain-relief balm, and laundry blue (neel). Cash on Delivery only. Build the whole thing in one pass — do not stop to ask me questions unless something is genuinely ambiguous.

## 1. Non-negotiable constraints

Read these first. Every decision below must respect them.

1. **Speed is the primary feature.** Target Lighthouse mobile Performance ≥ 95, LCP < 2.0s on simulated 4G, CLS < 0.05, INP < 200ms. Most traffic is mobile users in Pakistan on 4G.
2. **Light theme only.** No dark mode. No dark hero.
3. **Exactly one 3D element on the entire site** — a slowly rotating product bottle in the hero. Nowhere else. It must be lazy-loaded and must never block LCP (see §6).
4. **COD only.** No payment gateway, no Stripe, no card fields anywhere. Do not add a "payment method" step.
5. Ship a working app, not a scaffold. Every page, route, and admin action must actually function against the database.

## 2. Stack

- Next.js 15 (App Router, TypeScript, `strict: true`)
- Tailwind CSS v4
- Neon Postgres + Drizzle ORM + drizzle-kit migrations
- Zod for all input validation (shared schemas between client and server)
- Server Actions for cart-to-order submission; Route Handlers for admin APIs
- `zustand` + `persist` (localStorage) for cart state
- `next/font` (self-hosted, `display: swap`) — no external font CDN calls
- `next/image` everywhere, AVIF + WebP
- `@react-three/fiber` + `@react-three/drei` — **hero only**, dynamically imported
- Deploy target: Vercel

Do **not** add: a component library (build components yourself), Framer Motion for basic reveals (use CSS), Redux, tRPC, or any analytics SDK beyond a single GA4 snippet loaded with `next/script` strategy `afterInteractive`.

## 3. Brand and design direction

MARKORGANICS is an everyday Pakistani household and personal-care brand — the kind of bottle that sits on a bathroom shelf and in a kitchen cabinet. It is honest, functional, and trusted, not luxury and not startup-slick. The design should feel like a **well-designed apothecary label**, not a SaaS landing page.

**The central design device:** every product family gets its own color band, exactly like the printed band across a real bottle label. That band is the navigation, the category marker, the section divider, and the product card accent. This is the one bold idea — everything else stays quiet.

**Palette** (light, paper-based):

```
--paper      #FCFBF8   page background
--ink        #17150F   primary text
--ink-soft   #5A5449   secondary text
--rule       #E3DFD4   hairlines, borders
--band-oil   #C1841B   Oils family — mustard/amber
--band-care  #2E6A65   Relief family — deep menthol teal
--band-home  #2C3C8C   Home family — neel indigo
```

Use white for cards/surfaces on the paper background. The three band colors are used at full saturation only in bands, badges, and one CTA per section — never as large background washes, never as gradients.

**Typography** — two families, clearly distinct:
- Display: **Archivo** (variable) — headings set tight, weight 600–700, negative letter-spacing at large sizes. Product names in display.
- Body: **Inter Tight** — 400/500, 16px base, line-height 1.6, measure under 70ch.

Do not use all-caps eyebrow labels above headings. Do not accent one word of a headline in a different color. Do not append arrows to button text. Do not put the same border-radius and the same soft grey shadow on every card — cards get a hairline border and no shadow; only the sticky cart bar gets elevation.

**Motion:** one orchestrated moment only — the hero bottle's entrance and rotation. Section content appears without scroll-triggered fade-ups. Interactive feedback (add to cart, quantity change, form submit) gets motion because it shows what changed. Respect `prefers-reduced-motion` everywhere: it stops the 3D rotation and disables all transitions.

**Voice:** plain English, sentence case, active voice. "Add to cart" → toast says "Added". "Place order" → confirmation says "Order placed". No marketing filler, no exclamation marks.

## 4. Catalog

Seven products, three families. Prices in PKR — I will replace the placeholder values.

**Oils family** (band: `--band-oil`)
| Product | Variants | Placeholder price |
|---|---|---|
| Desire Drop | 15 ml | 1750 |
| Mustard Oil | 50 ml, 100 ml | 100 , 200 |
| Coconut Oil | 50 ml, 100 ml | 150 , 250 |
| Onion Oil | 100 ml | 250 |

**Relief family** (band: `--band-care`)
| Product | Variants | Placeholder price |
|---|---|---|
| MARK Balm | single | 250 |
| MARK Iodex | single | 220 |

**Home family** (band: `--band-home`)
| Product | Variants | Placeholder price |
|---|---|---|
| MARK Liquid Neel | single | 250 |

Every product needs: name, slug, family, short description (one line), long description, `howToUse` (3–5 steps), `ingredients` (text), `benefits` (3–4 bullets), images, and per-variant SKU, size label, price, compare-at price (nullable), stock quantity.

Seed the database with all six products and realistic copy you write yourself. Use `/public/products/<slug>-1.jpg` style paths; generate lightweight SVG placeholders at those paths so the build works before I add real photos.

## 5. Pages and routes

**Storefront**
- `/` — hero (§6), three family sections each opening with its color band, bestsellers, trust strip (COD, nationwide delivery, easy returns), brand story block
- `/products` — all products, filter by family, no pagination needed for six items
- `/products/[slug]` — gallery, variant selector (size pills, disabled when out of stock), price, quantity stepper, add to cart, accordion for How to use / Ingredients / Benefits, related products from the same family
- `/cart` — line items, quantity edit, remove, subtotal, delivery charge, total
- `/checkout` — COD form only (§7)
- `/order/[orderNumber]` — confirmation and status
- `/track` — look up an order by order number + phone
- `/about`, `/contact`, `/faq`, `/shipping-returns`, `/privacy`
- `not-found.tsx` and `error.tsx` with real copy, not defaults

**Admin** — `/admin/*`
- `/admin/login` — single password from `ADMIN_PASSWORD` env var, verified server-side, sets an httpOnly signed session cookie; middleware protects every `/admin` route except login
- `/admin` — today's orders, pending count, low-stock warnings, 7-day revenue
- `/admin/orders` — table with search (order number / phone / name), filter by status and date, click through to detail
- `/admin/orders/[id]` — full order, customer details, items, change status, internal note, one-click "copy address for courier", `wa.me` link to message the customer
- `/admin/products` — list, create, edit, archive; per-variant price and stock editing; image URL fields
- CSV export of filtered orders

Order statuses: `pending → confirmed → shipped → delivered`, plus `cancelled` and `returned`. Status changes are logged in an `order_events` table with timestamp.

## 6. The hero (read carefully)

Left column: product wordmark, one-line proposition, two buttons ("Shop oils" primary, "See all products" secondary). Right column: the 3D bottle.

Rules for the 3D:
- Component lives in `components/hero/BottleCanvas.tsx`, imported with `next/dynamic` and `ssr: false`
- Do **not** mount it until the page is interactive and the hero is in view — use an `IntersectionObserver` plus `requestIdleCallback` fallback
- Until then, render `/public/hero-bottle.webp` (a static render) in the exact same box. **This static image is the LCP element** and must be preloaded. The canvas fades in over it when ready.
- Load `/public/models/bottle.glb` with `useGLTF` + `<Suspense>`. Ship a Draco-compressed model under 800KB; if the file is missing, fall back to a procedural bottle built from `Cylinder` + `Torus` geometry so the build never breaks
- Scene: neutral studio lighting (`Environment preset="studio"`), soft contact shadow, no postprocessing, no bloom
- `<Canvas dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }}>`, `frameloop="demand"` is not appropriate here since it rotates — instead cap rotation to a slow `useFrame` delta-based spin
- **On viewports under 768px, or when `prefers-reduced-motion: reduce`, or when `navigator.connection.saveData` is true: never mount the canvas at all.** The static image stays. Mobile users get zero 3D bytes.
- Route-level code splitting must ensure three.js does not appear in the shared chunk — verify with `@next/bundle-analyzer` and report the numbers to me at the end

## 7. Checkout (COD)

Single page, no multi-step wizard. Fields:

- Full name (required, 3–60 chars)
- Phone (required) — Pakistani mobile, accept `03XXXXXXXXX` and `+923XXXXXXXXX`, normalize to `+92` format for storage
- Alternate phone (optional, same validation)
- City (required) — searchable select from a `PK_CITIES` constant covering all major Pakistani cities, with free-text fallback
- Full address (required, 10–200 chars)
- Order notes (optional)

Behaviour:
- Delivery charge: flat `<<<DELIVERY_FEE>>>` PKR, free above `<<<FREE_SHIPPING_THRESHOLD>>>` PKR. Both configurable in one `config/commerce.ts` file.
- A visible COD notice: amount payable to the rider on delivery.
- On submit, a Server Action: validates with Zod, re-reads live prices and stock **from the database** (never trust client prices), checks stock, decrements stock inside a transaction, creates order + order_items + first order_event, generates a human order number (`MRK-` + 6 chars), clears the cart, redirects to `/order/[orderNumber]`.
- Race-safe: if stock ran out between page load and submit, fail cleanly with a specific message naming the item.
- Rate limit order creation by IP (simple in-memory or Neon-backed counter) to block spam orders.
- Honeypot field for bots.

## 8. Data model (Drizzle)

`products`, `product_variants`, `orders`, `order_items`, `order_events`, `admin_sessions`. Use `uuid` primary keys, `timestamptz` for all times, and store money as **integer paisa** — never floats. Index `orders.order_number`, `orders.phone`, `orders.created_at`, `product_variants.sku`.

Order rows snapshot the product name, variant label, and unit price at purchase time so later price edits never rewrite history.

## 9. SEO and structured data

- Per-page `generateMetadata`, OG image via `opengraph-image.tsx`
- `Product` + `Offer` JSON-LD on product pages (`priceCurrency: "PKR"`, availability from live stock), `Organization` on the homepage, `BreadcrumbList` on product pages
- `app/sitemap.ts` and `app/robots.ts`
- Semantic HTML, one `h1` per page, real `alt` text on every image
- Also generate `app/feed/meta/route.ts` and `app/feed/google/route.ts` — XML product feeds built from the live catalog, correctly formatted for Meta Commerce Manager and Google Merchant Center. Cache them for one hour. I will connect them later.

## 10. Quality floor

- Fully responsive from 360px up
- Visible keyboard focus rings, correct ARIA on the cart drawer, variant pills, and accordions, skip-to-content link
- Colour contrast ≥ 4.5:1 for body text against paper
- No layout shift: every image has explicit dimensions, fonts use `size-adjust`
- Loading and empty states written as directions, not apologies — an empty cart says what to do next
- `.env.example` listing every variable
- `README.md` with setup, migration, seeding, and deployment steps

## 11. Deliverables at the end

When you're done, report:
1. Route list with each route's first-load JS
2. Confirmation that three.js is absent from the shared chunk and from all mobile paths
3. Exactly which placeholder files I need to replace (photos, `bottle.glb`, logo, favicon) and the required dimensions of each
4. Any decision you made that you'd flag for review

Build it now, start to finish.
