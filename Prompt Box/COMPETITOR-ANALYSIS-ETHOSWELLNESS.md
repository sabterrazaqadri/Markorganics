# Competitor analysis: ethoswellness.pk vs MARKORGANICS

Date: 2026-09-14. Method: fetched homepage, `/collections/all`, `/products.json`, two product pages, policies, about, sitemaps, `robots.txt`; inspected raw HTML for apps, scripts, structured data and page weight. Our side: repo audit (`app/`, `components/`, `lib/db/schema.ts`) plus the live Neon catalog.

## 1. Ethos Wellness snapshot

| Area | Finding |
| --- | --- |
| Platform | Shopify, Dawn theme 15.4 ("Upgraded Dawn theme 13-05-26"), Lahore (65C Punjab Small Industrial Estate, Sundar Raiwind Rd) |
| Catalog | 26 products. 8 problem-named oils (Nerve, Joint, Muscle, Heel, Headache Off, Good Sleep, Piles Free, Men Essential) at Rs 1,499 to 2,999. Shilajit gummies Rs 2,999 (compare 4,999). 4 vitamin tablets Rs 625 to 1,990. 11 combos at 29 to 30 percent off. |
| Men Essential Oil (our direct rival for Josh) | 30 ml Rs 2,999 (compare 3,999); 10 ml Rs 1,299 (compare 1,800). Ginseng, ashwagandha, tribulus, maca. 6 images. Free 5 shilajit gummy samples with purchase. |
| Apps | Air Reviews (Avada), AOV Bundle Upsell, AiCartMax (cart upsell + free-shipping bar), Essential Post-Purchase Upsell, UpPush Order Limit, Dondy WhatsApp chat widget, GA4 via gtag. No COD form app: checkout is stock Shopify checkout. |
| Trust | Badges: ISO Certified, 100% Natural, Halal Certified, Organic Product. Homepage claims 500+ reviews at 4.8, "1000+ daily customers", "200K+ products sold". Real per-product review counts in the widget: 16 to 28. |
| Content | 25 blog URLs targeting pain and men's-health keywords (best oil for knee joint pain, erectile dysfunction oil, shilajit benefits, aromatherapy, essential vs carrier oils). |
| Offers | Free shipping on bundles (search snippet says free shipping on all orders). Sitewide 11 to 40 percent "limited offer" badges. Countdown timer. |
| Agentic commerce | `robots.txt` advertises Shopify UCP/MCP endpoint (`/api/ucp/mcp`) and `agents.md`. |
| Contact | 03295940000 (site), +92 311 1138467 (refund policy page), info@ethoswellness.pk, instagram.com/ethosoilspk. |

## 2. Where they beat us

1. Positioning and price. Every product is named after a pain point and sells at Rs 1,499+. Our catalog is commodity (Mustard Rs 100, Neel Rs 250) plus one premium item (Josh Rs 1,750). Their AOV absorbs the Rs 150 to 250 COD courier cost; on a Rs 100 order that cost exceeds the order.
2. Reviews. Per-product Urdu and English reviews on PDP and a homepage slider. We have no `reviews` table.
3. AOV stack. 11 combos, free-shipping progress bar, cart upsell, post-purchase upsell, free gift with order. We only have discount codes.
4. Content and SEO. 25 blog posts on buyer-intent keywords. Our blog is database-backed but empty.
5. Certification badges. ISO, Halal, Organic (unverifiable but they convert). We only show COD, nationwide delivery, easy returns.
6. PDP conversion elements. 6 to 8 images, "Order on WhatsApp" button, sticky add-to-cart, ask a question, wishlist, share, free gift callout. Ours: gallery, three accordions, related products.
7. Free shipping on every order. We are threshold-based.
8. They are live and indexed. `markorganics.pk` does not resolve; `NEXT_PUBLIC_SITE_URL` is still localhost.

## 3. Where we beat them

1. Performance. Their homepage HTML alone is 889 KB, PDP 801 KB, 75 script tags and 21 stylesheets. Ours is Next 15 SSG with 60 s revalidation, self-hosted fonts, desktop-only 3D.
2. Checkout. Stock Shopify checkout in Pakistan is multi-step and email-first. Ours is a single-page, phone-first COD form with city select and honeypot.
3. Back office. Custom admin with COD risk warning, courier integrations (Leopards, PostEx, BlueEx, M&P), loadsheets, WhatsApp Cloud API threads, abandoned-checkout recovery, segments, activity log, Google/Meta/TikTok feeds. They cannot track per-customer delivery success rate.
4. Structured data. We emit Product, Offer, Organization, BreadcrumbList and BlogPosting JSON-LD. Their PDP has only Product and Offer: no AggregateRating (no stars in Google), no FAQPage.
5. Zero platform fees. Shopify plus six apps is roughly USD 90 to 140 a month plus transaction fees.
6. Entry price. Rs 100 to 250 trial risk versus their Rs 1,499 first-order COD ask.

## 4. Their mistakes (exploitable)

- Countdown timer expired: `countdown-end="2025-12-31"`, renders `00D : 00H : 00M : 00S` next to "Limited offer".
- Placeholder urgency: "-- people viewing", "-- sold in last -- hours" render unfilled.
- Three different return windows: 7 days (policy page), 14 days (FAQ), 30 days (PDP). Two different phone numbers.
- Men Oil PDP shows "Variant sold out or unavailable" while also saying in stock.
- Nerve Care Oil has no ingredient list ("essential oil blends").
- Reviews page is JS-only; crawlers see zero reviews.
- Duplicate blog URLs: `men-essential-oils`, `-1`, `-2`, `-3`, `blog`, `blog-1`.
- Payment methods are never stated anywhere; COD is not mentioned on homepage or PDP.
- Disease claims (sciatica, diabetes-related nerve pain, ED, piles): DRAP and Meta ads policy risk.
- English-only copy despite Urdu-reading customers.

## 5. Bypass plan

### A. Product and positioning (not code)

1. Launch a "Relief" line at Rs 800 to 1,200 (MARK Joint Oil, MARK Nerve Oil 30 ml) against their Rs 1,499 to 1,599.
2. Position Josh Mens Herbal Oil (Rs 1,750, 15 ml) directly against their Men Essential Oil (Rs 2,999, 30 ml): same job, 40 percent less, discreet packaging, no fake urgency.
3. Combos: Balm + Iodex "Winter Pain Kit", Onion + Coconut "Hair Kit", Josh + Mustard "Massage Kit". 25 to 30 percent off, lifts AOV above Rs 600 so COD courier cost is covered.
4. Free gift with every order (Balm 25 g sample, cost about Rs 40) to mirror their gummy sample.

### B. Storefront build list (implemented in this pass)

| # | Feature | Why |
| --- | --- | --- |
| 1 | Reviews table, PDP widget, admin moderation, AggregateRating JSON-LD | Their biggest edge; JSON-LD gives us SERP stars first |
| 2 | Bundle product type (component variants, single stock deduction) | AOV; inventory ledger already tracks committed and on-hand |
| 3 | Cart free-shipping progress bar + "add Rs X more" upsell | Mirrors AiCartMax; threshold already in settings |
| 4 | PDP "Order on WhatsApp" button (prefilled product and variant) + sticky mobile bar | WhatsApp is 20 to 40 percent of COD orders in Pakistan |
| 5 | Trust badge row (lab tested, Halal, Made in Pakistan, 7-day return) + explicit payment methods (COD, JazzCash, EasyPaisa) | Their payment info is missing |
| 6 | FAQ accordion per product + FAQPage JSON-LD | They have none |
| 7 | Real low-stock and sold-count from the database | Theirs are placeholders; ours are genuine |
| 8 | Urdu toggle (`lang="ur"`, RTL) on PDP and checkout | Their gap |
| 9 | Post-purchase upsell on the order confirmation page (add to the same parcel) | Mirrors Essential Post-Purchase; order editing already exists |
| 10 | Blog: 20 posts on their exact keywords plus Urdu versions | Their duplicate URLs lose to a clean structure |

Hero: Josh Mens Herbal Oil is the featured product. Hero copy, CTA and the price anchor should target the Men Essential Oil comparison.

### C. Immediate (this week)

- Point the domain at Vercel and set `NEXT_PUBLIC_SITE_URL`.
- Verify Meta Pixel and GA4 fire on production.
- Check their Meta Ad Library manually (not tracked in AdWhispr); copy formats, not claims.

### D. Do not copy

- Fake countdowns and fake counters.
- Disease claims. Use comfort, warmth, massage language: DRAP-safe and Meta-ads-safe.
