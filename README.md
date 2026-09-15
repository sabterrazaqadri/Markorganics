# MARKORGANICS storefront

Cash-on-delivery e-commerce storefront and admin panel for MARKORGANICS, built with Next.js 15 (App Router), Tailwind CSS v4, Neon Postgres and Drizzle ORM.

## Stack

- Next.js 15, React 19, TypeScript strict
- Tailwind CSS v4 (design tokens live in `app/globals.css`)
- Neon Postgres via `@neondatabase/serverless`, Drizzle ORM, drizzle-kit migrations
- Zod 4 for every input (schemas shared by client and server)
- zustand + localStorage for the cart
- `@react-three/fiber` + `drei` for the single hero 3D bottle, dynamically imported, desktop only
- Deploy target: Vercel

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
```

Environment variables (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon connection string (pooled host recommended) |
| `ADMIN_EMAIL` | Email of the first Owner account, created on first sign-in |
| `ADMIN_PASSWORD` | Password for that first Owner (10+ characters) |
| `ADMIN_NAME` | Display name for the first Owner (optional) |
| `ADMIN_SESSION_SECRET` | 32+ random chars, signs the admin cookie |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin, used in metadata, sitemap, feeds |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | International format without `+` |
| `NEXT_PUBLIC_GA_ID` | GA4 measurement ID, leave empty to disable |

## Database

```bash
npm run db:generate    # create a migration from lib/db/schema.ts (only after schema edits)
npm run db:migrate     # apply migrations in ./drizzle to DATABASE_URL
npm run db:seed        # upsert the seven products (idempotent; add --reset to overwrite prices and stock)
npm run db:backfill    # derive customers, ledger, pages, menus and settings from existing data
npm run db:seed-admin  # create the first Owner from ADMIN_EMAIL / ADMIN_PASSWORD
npm run db:seed-storefront  # FAQ pairs, Urdu copy and the three kits (idempotent; --reset overwrites edited copy)
npm run db:seed-blog        # ten journal posts plus their Urdu versions (idempotent; --reset overwrites edits)
npm run db:studio      # optional: browse data with drizzle-kit studio
```

Migrations live in `drizzle/`. `db:migrate` runs `scripts/migrate.ts`, which applies
them one statement at a time over the Neon HTTP driver; `db:kit-migrate` is the
stock drizzle-kit runner, kept as a fallback.

`db:backfill` is idempotent and safe to re-run. It creates one customer per
normalised phone number from the existing orders, records an opening balance in
the inventory ledger, seeds the content pages, policies, notification templates
and menus, and indexes product images into the media library.

## Placeholder assets

```bash
npm run placeholders
```

Regenerates every placeholder image from SVG via sharp. Replace these files with real assets, keeping the same paths and dimensions:

| Path | Dimensions | Notes |
| --- | --- | --- |
| `public/products/<slug>-1.jpg`, `-2.jpg` | 1200 x 1200 JPG | One pair per product; slugs in `lib/db/seed-data.ts` |
| `public/hero-bottle.png` | 5:6 portrait, 1000 x 1200 or larger | Hero visual and the LCP element. Keep it a single centred bottle on a plain `#FCFBF8` background: the 3D canvas cross-fades over it in the same frame. |
| `public/brand-story.jpg` | 1200 x 800 JPG | Homepage brand block |
| `public/logo.svg` | 180 x 32 | Wordmark used in JSON-LD and OG |
| `app/icon.png` | 64 x 64 PNG | Favicon |
| `app/apple-icon.png` | 180 x 180 PNG | Apple touch icon |
| `public/models/bottle.glb` | Draco-compressed, under 800 KB | Optional. Missing today: the hero uses a procedural bottle. Draco decoders are served from `public/draco/` |
| `public/hdr/studio.hdr` | 512 x 256 Radiance, 512 KB | Self-hosted studio lighting for the hero canvas. Sourced from `studio_small_03_1k.hdr` in pmndrs/drei-assets, then downsampled with `npx tsx scripts/prep-hdr.ts 512`. Desktop-only and requested only once the canvas mounts. |

## Run

```bash
npm run dev       # http://localhost:3000
npm run build
npm run start
npm run analyze   # build with @next/bundle-analyzer; opens client/server treemaps
npm run typecheck
npm run lint
```

## Commerce configuration

Delivery pricing, the free-shipping threshold, the store name and the order
number prefix live in the `settings` table and are edited at
`/admin/settings`. `config/commerce.ts` remains the fallback when a row is
missing, so a fresh database still behaves. Money is stored and calculated as
integer paisa everywhere.

## Storefront conversion features

- **Hero.** Built around `FEATURED_PRODUCT_SLUG` (`config/commerce.ts`): live price, compare-at, stock, rating and a
  direct add-to-cart. Falls back to the brand hero if the product is unpublished.
- **Reviews.** `reviews` table. Storefront submissions land as `pending` and go live only after approval at
  `/admin/reviews`; staff can also add reviews collected on WhatsApp. A review whose phone matches a delivered order
  for the product is marked verified. Approved reviews are server-rendered and emitted as `AggregateRating` and
  `Review` JSON-LD.
- **Kits (bundles).** A product with `isBundle` sells other variants together at one price (`bundle_components`).
  Kit stock is derived from the parts and mirrored onto the kit variant after every ledger movement. At checkout the
  kit expands into one order line per part (price split proportionally, `bundle_sku` / `bundle_name` set), so stock,
  restocks, packing slips and feeds only ever see real variants. Managed in the product editor under "Kit".
- **Added-to-cart pop-up.** Every add from a product page or the hero opens `AddedModal` (bottom sheet on phones,
  centred on desktop) with the line just added, the cart total, and two ways on: Checkout or Shop more.
- **Free-delivery bar.** `quoteCart` returns the remaining amount and up to three products that reach the threshold;
  the cart drawer, cart page and checkout show a progress bar with one-tap adds.
- **WhatsApp ordering.** Product pages and the hero carry an "Order on WhatsApp" link with the product, size,
  quantity, price and URL prefilled.
- **Trust badges and payment methods.** `TrustBadges` lists the four promises the shop keeps. Payment methods come
  from store settings (COD always; JazzCash, EasyPaisa and bank transfer are switches at `/admin/settings`).
- **FAQ.** `products.faqs` (Q/A pairs, edited as `Q:` / `A:` blocks) render in the accordion and as `FAQPage` JSON-LD.
- **Real social proof.** "Only N left" uses each variant's own threshold; "ordered by N people in the last 24 hours"
  and "N sold in the last 30 days" are computed from orders and shown only past a minimum, never as placeholders.
- **Urdu.** `products.i18n.ur` holds per-field Urdu copy (English fills gaps). Pages stay static: both languages are
  in the HTML and `<html data-lang>` picks one (`store/lang.ts`, `components/i18n/*`, `.lang-en` / `.lang-ur` in
  `globals.css`). The checkout form reads its strings from `lib/i18n/checkout.ts`. Blog posts have a `lang` and a
  `translationSlug`; Urdu posts render right-to-left with `hreflang` alternates.
- **Post-purchase upsell.** For an hour after checkout, while the order is pending, the order page offers three items
  that can be added to the same parcel. `placeOrder` sets a signed `mrk_o_<number>` cookie; `addToOrderAction`
  verifies it, locks stock, writes the ledger and re-judges delivery (a top-up can make delivery free, never dearer).

## Admin

A full back office at `/admin`, in its own route group with its own stylesheet
(`app/admin/admin.css`) so none of it reaches a storefront route.

**Accounts.** Real staff accounts in `users`, bcrypt-hashed, with three roles:
Owner (everything), Manager (no settings or staff) and Staff (orders and
customers, read-only products). Sessions are rows in `user_sessions` plus an
HMAC-signed httpOnly cookie valid for 7 days, with a "sign out all devices"
action. Sign-in is rate limited per email and per IP: ten failures locks that
scope for 15 minutes. Permissions are enforced inside every Server Action by
`requirePermission()`, never by hiding UI alone.

**Modules.**

| Route | What it does |
| --- | --- |
| `/admin` | Dashboard: today, pending calls, 7-day revenue, delivery success rate, abandoned carts, low stock |
| `/admin/orders` | Saved-view tabs, nine filters, bulk status and tagging, CSV export, cursor pagination |
| `/admin/orders/[id]` | Timeline, line editing with stock movement, tags, customer context, COD risk warning |
| `/admin/orders/[id]/print` | A5 packing slip with a Code 39 barcode; `/admin/orders/print?ids=` batches them |
| `/admin/drafts` | Phone and wholesale orders. Stock is taken only on conversion |
| `/admin/abandoned` | Checkouts started but not submitted, with a prefilled `wa.me` link |
| `/admin/products` | Status, type, vendor, tags, metafields, collections; bulk edit and CSV import with a dry run |
| `/admin/collections` | Hand-picked (drag to reorder) or rule-based, re-evaluated on every product save |
| `/admin/inventory` | Available, committed and on hand, inline adjustment with a reason, full per-variant history |
| `/admin/files` | Media library with alt text and a usage check before deletion |
| `/admin/customers` | Keyed on the `+92` phone number, with lifetime value and delivery success rate |
| `/admin/segments` | Live rule-based groups, exportable to CSV |
| `/admin/discounts` | Code and automatic, four types, conditions and limits, usage and revenue tracking |
| `/admin/reviews` | Pending, approved and rejected reviews; approve, reject, reply, delete, or add one from WhatsApp |
| `/admin/content` | Database-backed pages, a scheduled blog, and the header and footer menus |
| `/admin/analytics` | Real aggregates with previous-period comparison, cached 5 minutes, CSV export |
| `/admin/activity` | Every mutation with user, before/after diff, timestamp and IP |
| `/admin/settings` | Store details, delivery, policies, notification templates, metafields, staff, JSON backup |

Global search is on Cmd/Ctrl+K. Every list paginates on a keyset cursor and
filters in Postgres, never in the browser.

**Deletion.** Everything is soft-deleted except media files, whose bytes have to
go. The audit log is never pruned.

## Feeds and SEO

- `/feed/google` and `/feed/meta`: RSS 2.0 product feeds with the `g:` namespace, cached for one hour.
- `/sitemap.xml`, `/robots.txt`, per-page metadata, OG images, Product/Offer, Organization, BlogPosting and BreadcrumbList JSON-LD.
- `/blog` and `/blog/[slug]` are database-backed, with scheduled publishing handled by the query rather than a cron job.

## Deploy to Vercel

1. Push the repo and import it in Vercel.
2. Add the environment variables above. Use the pooled Neon host for `DATABASE_URL`.
3. Run `npm run db:migrate`, `npm run db:seed` and `npm run db:backfill` once against the production database (locally with the production `DATABASE_URL`, or as a one-off command). Then sign in at `/admin/login` with `ADMIN_EMAIL` and `ADMIN_PASSWORD` to create the first Owner.
   Uploads are written to `public/uploads`, which is read-only on Vercel: the media library falls back to "Add by URL" there until `app/api/admin/files/upload/route.ts` is pointed at a blob provider.
4. Deploy. Product pages and the homepage are statically generated and revalidated every 60 seconds; admin and order pages are dynamic.
