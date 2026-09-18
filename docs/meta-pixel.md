# Meta Pixel + Conversions API

The shop sends every tracked event twice — once from the browser pixel, once
from the server — and relies on a shared `event_id` so Meta counts each one
once. This doc covers where each event fires, how the two copies stay in
sync, how to check it in Events Manager, and how to turn it off.

## Where credentials live

Unlike a typical Next.js pixel setup, the Pixel ID, Conversions API access
token, test event code and Graph API version are **not** plain environment
variables. They are configured at **`/admin/integrations` → Ad platforms → Meta**
and stored encrypted in the `integrations` table (see `lib/integrations`).
This is the same system used for WhatsApp, PostEx and TikTok, and it means:

- Rotating a token doesn't need a redeploy.
- The integration has a **dry run** switch and an **enabled** switch,
  independent of each other — see "How to disable" below.
- `META_ACCESS_TOKEN`, `META_PIXEL_ID`, `META_TEST_EVENT_CODE` and
  `META_GRAPH_VERSION` in `.env.example` are only a **local-dev fallback**,
  read when no value is saved in the admin. Never put a production token
  there.

`NEXT_PUBLIC_GA_ID` still works as a plain env var for GA4 (see
`lib/settings.ts` `readStorefrontIntegrations`), but Meta and TikTok read the
admin-configured row first.

## Events and where they fire

| Event (Meta name) | Internal name | Fires from |
|---|---|---|
| `PageView` | — | `Analytics` init snippet on first load, `RouteChangeTracker` on every client-side navigation |
| `ViewContent` | `view_item` | Product detail page (`app/(store)/products/[slug]/page.tsx` via `TrackEvent`) |
| `AddToCart` | `add_to_cart` | Product page (`PurchasePanel`), hero buy box (`HeroBuy`), free-delivery-bar one-tap adds (`FreeShippingBar`), post-purchase upsell (`OrderUpsell`) |
| `InitiateCheckout` | `begin_checkout` | Checkout page mount (`CheckoutForm`) |
| `Purchase` | `purchase` | **Twice**: the thank-you page (`app/(store)/order/[orderNumber]/page.tsx`) on the browser, and the job runner (`lib/jobs/handlers.ts` → `lib/analytics/purchase.ts`) on the server, enqueued from `placeOrder` in `app/(store)/checkout/actions.ts` right after the order commits |
| `Contact` | `contact` | WhatsApp link clicks (`components/analytics/WhatsAppLink.tsx`) — not in the original five, but wired the same way since most orders in month one close on WhatsApp, not checkout |

`content_ids` are always the variant **SKU** — the same id used as `g:id` in
`/feed/meta` (`lib/feeds.ts`) and in the Product JSON-LD. A kit/bundle
expands to its component SKUs the same way `placeOrder` does, so the feed,
the events and the order rows always agree. Values are always rupees
(`rupees()` in `lib/analytics/events.ts` divides stored paisa by 100) and
currency is always `PKR`.

The pixel and its `<noscript>` fallback, plus GA4 and TikTok, mount in
**`app/(store)/layout.tsx` only**. They do not load anywhere under
`/admin/**` — that route group nests inside the same root `<html>` in
`app/layout.tsx`, but the root layout no longer renders `<Analytics>` itself.

## How deduplication works

1. **Purchase**: `lib/analytics/event-id.ts` computes
   `evt_purchase_<sha256(orderId)>`. The order page renders this id and hands
   it to the browser's `TrackEvent`/`trackEvent()` as `eventID`; the job
   runner computes the identical id independently from the same order id and
   sends it as `event_id` in the CAPI payload. Same event, same id, from two
   places that never talk to each other — Meta keeps one.
2. **Everything else** (`ViewContent`, `AddToCart`, `InitiateCheckout`,
   `Contact`): the browser pixel fires with a client-generated id
   (`clientEventId()`), then `trackEvent()` immediately POSTs the same
   event/id pair to `/api/meta-event`, which calls the same
   `sendMetaEvent()` the purchase job uses. Browser and server always carry
   the same `event_id` and `event_name` for the same click.
3. Every CAPI payload also carries `fbp`/`fbc` (read straight from the
   `_fbp`/`_fbc` cookies), `client_ip_address`, `client_user_agent`, and
   `event_source_url` — these are what let Meta match the two copies to the
   same person even before it gets to the id.

Purchase is deliberately refused at `/api/meta-event` (see the comment at the
top of `app/api/meta-event/route.ts`): a thin browser-only Purchase must
never win the dedup race against the rich, hashed-identity one the job
runner sends.

## Verifying in Events Manager (test mode)

1. In `/admin/integrations` → Ad platforms → Meta, paste a **test event code**
   from Events Manager's "Test events" tab, then save (enabled + not dry
   run).
2. Walk the funnel: open a product page, add it to cart, go to checkout,
   place an order.
3. In Events Manager → Test events, confirm:
   - `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout` and
     `Purchase` all arrive.
   - `Purchase` shows **both** a Browser and a Server source on the same
     event row, marked **Deduplicated** — not two separate rows.
   - The `Purchase` value matches the order total in rupees.
   - **Event match quality** for `Purchase` is a real score, not near zero.
     If it's low, check phone normalisation first
     (`lib/analytics/hash.ts` / `normalizePhoneForMeta`, unit-tested in
     `tests/meta-hash.test.ts`) — a wrong phone format is the single most
     common cause of a dead match score on a COD store.
4. Remove the test event code before going live; events sent with one set
   never reach the main "Overview" tab.

## How to disable

- **Fastest, reversible**: `/admin/integrations` → Ad platforms → Meta → turn
  off "Enabled". No pixel loads, no CAPI calls are made, and the checkout
  flow is completely unaffected (the enqueue still happens but
  `sendMetaEvent` returns immediately with `dryRun`/`isEnabled: false`).
- **Dry run**: leave it enabled but turn on "Dry run" (or the global dry-run
  switch that covers every integration) to keep the code path exercised
  without sending anything to Meta — useful while testing the funnel above
  without touching real ad data.
- **Local dev without an admin row**: leave the `META_*` variables in
  `.env.local` unset; with no Pixel ID configured anywhere, `Analytics`
  renders nothing and `sendMetaEvent` short-circuits with "No Meta pixel id
  is configured."
- A CAPI failure never fails an order: `dispatchPurchase` and every send
  path is wrapped so a rejected or slow request to Meta only ever affects
  the ad account's data, never the customer's checkout.
