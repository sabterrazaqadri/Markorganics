# Claude Code Prompt — Meta Pixel + Conversions API for MARKORGANICS

Copy everything below the line into Claude Code from the repo root.

---

## Task

Add Meta Pixel (browser) and Meta Conversions API (server) to this Next.js 15 App Router storefront, with proper event deduplication between the two. This is a cash-on-delivery store in Pakistan; the ad account currently has zero conversion signal, so this integration is the whole point — correctness matters more than speed.

Read `README.md`, `lib/db/schema.ts`, `config/commerce.ts` and the checkout server action before writing any code. Follow the conventions already in the repo: TypeScript strict, Zod 4 for input validation, money as integer paisa, Server Actions for mutations.

## Environment variables

Add to `.env.example` with comments:

- `NEXT_PUBLIC_META_PIXEL_ID` — pixel ID, browser-side
- `META_CAPI_ACCESS_TOKEN` — server-side only, never exposed to the client
- `META_TEST_EVENT_CODE` — optional, for Events Manager test mode; unset in production
- `META_CAPI_ENABLED` — optional kill switch, defaults to true when the token is present

Every one of these must be optional at runtime. If `NEXT_PUBLIC_META_PIXEL_ID` is missing the site must build and run exactly as it does today, with no console errors. Mirror how `NEXT_PUBLIC_GA_ID` is already handled.

## Part 1 — Browser pixel

Create a `MetaPixel` client component and mount it in the **storefront** layout only. It must not load on any `/admin` route — check how `app/admin` is separated into its own route group and respect that boundary.

Load `fbevents.js` with `next/script` using `strategy="afterInteractive"`. Include the `<noscript>` image fallback.

Fire `PageView` on initial load and on client-side navigation (`usePathname` + `useSearchParams` in a `Suspense` boundary, so it doesn't opt the whole tree into dynamic rendering).

## Part 2 — Event coverage

Implement these five events. For each, the `value` must be in **rupees as a decimal** (divide the stored paisa by 100) and `currency` must be `PKR`.

| Event | Where | Key params |
|---|---|---|
| `PageView` | every storefront route | — |
| `ViewContent` | product detail page | `content_ids`, `content_type: "product"`, `value`, `currency` |
| `AddToCart` | every add — product page, hero, free-delivery bar one-tap adds, post-purchase upsell | `content_ids`, `value`, `currency`, `contents` |
| `InitiateCheckout` | checkout page mount | `content_ids`, `contents`, `num_items`, `value`, `currency` |
| `Purchase` | order placed | `content_ids`, `contents`, `value`, `currency`, `order_id` |

`content_ids` **must** match the item IDs emitted by the existing `/feed/meta` product feed. Read that route handler and reuse the same ID derivation — if the IDs don't match, catalog attribution silently breaks. For bundles/kits, expand to the component variants the same way `placeOrder` does, so the feed and the events agree.

## Part 3 — Conversions API with deduplication

Create `lib/meta/capi.ts` as a small server-side client for the Graph API `/events` endpoint (use a recent API version and pin it in one constant).

**Deduplication is the critical part.** Every event that fires in both places must carry the same `event_id` and the same `event_name`, or Meta will double-count. Generate the `event_id` once (`crypto.randomUUID()`), pass it to the browser pixel as `eventID`, and send it in the CAPI payload as `event_id`.

Every CAPI payload needs:

- `event_name`, `event_time` (unix seconds), `event_id`, `event_source_url`
- `action_source: "website"`
- `user_data.fbp` and `user_data.fbc` — read the `_fbp` and `_fbc` cookies server-side and forward them; these do most of the matching work
- `user_data.client_ip_address` and `user_data.client_user_agent` from request headers

**Purchase must be sent server-side from the `placeOrder` server action**, not only from the browser. This is a COD store — the order is real at that moment, and server-side is the only reliable path. Send it after the order row is committed. A CAPI failure must never fail the order: wrap in try/catch, log, move on.

## Part 4 — User data hashing

All personally identifying fields go to Meta SHA-256 hashed, lowercase hex. Never send anything in plaintext except `fbp`, `fbc`, IP and user agent.

Hash, from the order record:

- `ph` — phone. The repo already normalises to `+92` and keys customers on it. Meta wants digits only, country code included, no `+` or spaces → `923001234567`, then hash.
- `fn`, `ln` — trimmed, lowercased
- `ct` — city, lowercased, spaces removed
- `country` — `pk`, hashed

Write the normalisation as pure functions in `lib/meta/hash.ts` with unit tests in `tests/` matching the existing test setup. Get the phone normalisation right — a wrong format means zero match quality and the whole integration is pointless.

Do not send email unless the schema actually stores one. Do not invent fields.

## Part 5 — Safety and hygiene

- The CAPI access token must never appear in any client bundle. Verify with `npm run analyze` or by grepping the build output.
- No pixel, no events, no script on `/admin/**`.
- Do not log hashed or raw customer data.
- Rate-limit or fire-and-forget the CAPI call so checkout latency is unaffected.
- Handle `META_TEST_EVENT_CODE` by adding `test_event_code` to the payload when set.

## Deliverables

1. The implementation.
2. `npm run typecheck` and `npm run lint` pass clean.
3. Unit tests for the hashing and normalisation helpers.
4. A short `docs/meta-pixel.md` covering: which events fire where, how dedup works, how to verify each event in Events Manager test mode, and how to disable the integration.

## Verify before you call it done

Walk the full funnel in test mode — product page → add to cart → checkout → place an order — and confirm in Events Manager that:

- All five events arrive
- `Purchase` shows **both** browser and server, marked as deduplicated rather than counted twice
- `Purchase` value matches the order total in rupees
- Event match quality for `Purchase` is reasonable, not near zero

Report the match quality score you see. If it's low, the phone hashing is the first thing to check.


Additional task — rename MARKORGANICS to MARKORGANIC

Rename the brand from "MARKORGANICS" to "MARKORGANIC" (drop the trailing S) everywhere it appears as a user-visible brand name. The new domain is markorganic.com.

Do NOT do a blind find-and-replace. Go through these deliberately:

User-facing copy: components, page metadata, OG tags, title templates, JSON-LD (Organization, Product, BlogPosting), trust badges, footer, policies
Urdu copy in products.i18n.ur and lib/i18n/checkout.ts — check the Urdu script spelling too, not just the Roman text
Seed data in lib/db/seed-data.ts, db:seed-storefront and db:seed-blog content
README.md, .env.example comments, package.json name
NEXT_PUBLIC_SITE_URL default and any hardcoded markorganics.vercel.app references
Notification templates, packing slip header, order confirmation copy

Important — the store name is in the database, not only in code. It lives in the settings table and is edited at /admin/settings, with config/commerce.ts as fallback. Update both: change the fallback in code, and write a one-off idempotent script in scripts/ that updates the existing settings row. A code-only change will leave the old name showing on a live database.

Also check the order number prefix in settings — if it contains the brand string, decide whether to change it. Changing it mid-stream breaks continuity with existing order numbers, so leave it alone unless it clearly reads as the brand to customers.

Leave alone: the GitHub repo name, database column names, existing product slugs (changing slugs breaks live URLs and the Meta product feed IDs), and any existing order records.

Afterwards run npm run typecheck and npm run lint, then grep the whole repo case-insensitively for markorganics and report anything left.
