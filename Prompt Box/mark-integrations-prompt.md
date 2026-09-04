# MARK — Integrations build (Claude Code prompt + your to-do list)

This file has two parts.
**Part A** is the prompt — paste it into Claude Code in the existing MARK project.
**Part B** is your own checklist of accounts and credentials. Do it after the build; the code is written to run safely without any of it.

---

# PART A — Claude Code prompt

Add an integrations layer to the existing MARK store: courier/logistics, WhatsApp, Meta, Google, and TikTok. Storefront and admin are finished and must not regress.

Build all of it in one pass. Everything must work end to end in **sandbox/dry-run mode with no real credentials**, so the build is verifiable before I obtain any API keys.

## Ground rules

1. **Never invent an API spec.** For each provider, either use the official documentation, or — where you don't have it — implement against the interface and mark the adapter `UNVERIFIED` with a clear TODO listing exactly which endpoint shapes I need to supply. A confidently wrong endpoint is worse than a stub.
2. **Every integration is off by default.** A missing credential disables that integration silently — it never throws, never blocks an order, never breaks a page. Placing an order must succeed even if every external service is down.
3. **Nothing external happens inside the order transaction.** The order commits first; integration work is queued after.
4. **Dry-run mode** is a global toggle. When on, every outbound call is logged in full (URL, headers with secrets redacted, body) and returns a realistic fake response. All tests run in this mode.
5. Secrets are stored encrypted (AES-256-GCM with a master key from env), never in plain text, never logged, never returned to the browser. The settings UI shows only the last 4 characters.

## 1. Job queue (build this first — everything else depends on it)

A `jobs` table plus a worker, since integrations fail and must retry.

- Fields: type, payload (jsonb), status (`queued`/`running`/`succeeded`/`failed`/`dead`), attempts, max attempts, run-after timestamp, last error, result, created/updated
- Exponential backoff with jitter: 1m, 5m, 15m, 1h, 6h — then `dead`
- Runner at `/api/jobs/run` protected by a secret header, triggered by a Vercel cron every minute; claims jobs with `FOR UPDATE SKIP LOCKED` so concurrent runs can't double-process
- Idempotency key per job so a retry never sends the same WhatsApp message or books the same shipment twice
- Admin view at `/admin/jobs`: filter by type and status, see payload and error, retry or kill a job manually

## 2. Courier / logistics

Build a **provider-agnostic adapter**, not a PostEx-specific integration. One interface, many couriers.

```ts
interface CourierAdapter {
  id: string
  getCities(): Promise<City[]>
  getPickupAddresses(): Promise<PickupAddress[]>
  createShipment(o: ShipmentInput): Promise<{ trackingNumber: string; labelUrl?: string }>
  cancelShipment(trackingNumber: string): Promise<void>
  track(trackingNumber: string): Promise<TrackingResult>
  getLoadsheet?(trackingNumbers: string[]): Promise<Buffer>
}
```

**Implement `PostExAdapter` fully.** Its Merchant API (v4.1.9) is documented and covers operational cities, pickup addresses, order types, create order, track order, and cancel order, with the API token passed in a `token` header. Its status vocabulary includes Unbooked, Booked, PostEx Warehouse, Picked By PostEx, En-route to warehouse, Out For Delivery, Attempted, Delivered, Returned, Out For Return, Expired, and Delivery Under Review — map every one of these to MARK's internal order status and store the raw status alongside.

**Scaffold `LeopardsAdapter`, `TCSAdapter`, `TraxAdapter`, `MPAdapter` and `BlueExAdapter`** against the same interface, each marked `UNVERIFIED` with a TODO block listing the fields you need from me. Do not guess their request shapes.

Then:
- **City mapping table**: MARK city → each courier's city ID, since every courier names cities differently. Admin UI to map them, with a warning banner listing unmapped cities. Auto-suggest matches on a fuzzy name comparison, but require a human to confirm each one.
- **Book from the order page**: pick courier and pickup address, book, store tracking number, move status to Shipped, append to the order timeline. Bulk-book selected orders from the orders list.
- **Status sync**: a cron job every 30 minutes polling all in-transit shipments, updating order status and timeline. If a courier offers webhooks, also expose a verified webhook endpoint and prefer it, falling back to polling.
- **Label and loadsheet**: store returned label URLs; generate a loadsheet PDF for a day's bookings.
- **Branded tracking**: `/track/[trackingNumber]` on MARK's own domain showing a clean timeline built from stored events — never redirect the customer to the courier's site.
- **COD reconciliation**: a `cod_remittances` table and an admin page to record what each courier actually paid out against what was collected, flagging shipments delivered more than N days ago with no payment received. This is where COD money quietly goes missing — make the discrepancy list impossible to miss.
- **Returns**: when a courier reports Returned, restore stock automatically (behind a settings toggle), increment the customer's return count, and update their delivery success rate.

## 3. WhatsApp (Cloud API)

Order lifecycle notifications through the official Cloud API.

- Adapter with `sendTemplate(to, templateName, variables)` and `sendText(to, body)`
- A `whatsapp_templates` table storing name, language, category, body with placeholders, and approval status. **Templates are authored and approved in Meta's Business Manager, not here** — this table mirrors them so the app knows what it may send.
- Triggers, each individually toggleable in settings: order placed, order confirmed, shipped (with tracking link to MARK's own tracking page), out for delivery, delivered, cancelled
- **Abandoned checkout follow-up**: a job scheduled N hours after abandonment (configurable, default 4), cancelled automatically if the customer orders in the meantime
- **Inbound webhook** with `X-Hub-Signature-256` verification: store incoming messages against the customer, show them in the customer profile, and surface an unread count in admin. Do not build a full chat inbox — a read-only thread with a `wa.me` link to reply is enough for now.
- **Cost tracking:** log every send with template name, category, and timestamp into a `whatsapp_messages` table, and show a monthly cost estimate in admin. Meta's pricing changes on 1 October 2026 — utility messages inside the 24-hour service window and free-form service replies stop being free — so make the per-category counts visible rather than burying them.
- Respect the 24-hour window: never attempt a free-form message outside it; use an approved template or skip.

## 4. Meta (Facebook + Instagram)

The catalog feed at `/feed/meta` already exists — keep it and complete the rest.

- **Pixel** via `next/script` (`afterInteractive`), firing PageView, ViewContent, AddToCart, InitiateCheckout, Purchase
- **Conversions API** server-side for the same events, sending a matching `event_id` on both sides so Meta deduplicates. Hash phone numbers and names with SHA-256 in the exact normalized form Meta requires — this is the part that's usually wrong, so write a unit test for the hashing.
- Purchase events fire from the server after the order commits, queued through the job runner
- Feed enrichment: correct `availability`, `condition`, `brand`, `google_product_category`, `item_group_id` for the 50ml/100ml variants
- Consent: a lightweight cookie banner; no pixel until accepted, but server-side events still fire for the customer's own transactional purchase

## 5. Google

- `/feed/google` already exists — verify it satisfies Merchant Center's requirements, including the multi-channel product ID rules that took effect in March 2026
- GA4 via `next/script`, with the standard ecommerce event set (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`) using GA4's exact parameter names
- Server-side purchase events through the Measurement Protocol, deduplicated against the client event
- Search Console verification meta tag from settings
- Confirm the existing Product/Offer JSON-LD passes the Rich Results test

## 6. TikTok

- **Pixel + Events API**, same dual client/server pattern with event deduplication
- `/feed/tiktok` product feed
- **TikTok Shop is out of scope.** Its Partner API is seller-gated and requires an approved Partner Center app, and the business region chosen at registration cannot be changed afterwards — and I have not confirmed TikTok Shop is available in Pakistan. Build only pixel, events, and feed. Leave a documented seam for Shop later.

## 7. Admin: Integrations

New section at `/admin/integrations`, Owner-only:

- One card per provider: connected/disconnected, credential fields, dry-run toggle, "Test connection" button that makes one harmless real call and reports the result verbatim
- Per-provider event log: last 100 calls with timestamp, endpoint, status, duration, and redacted payload
- Global dry-run master switch
- A health strip on the admin dashboard showing any integration currently failing

## Testing and deliverables

Write integration tests that run entirely in dry-run mode: a full order → courier booking → status sync → delivered flow, an abandoned checkout → WhatsApp follow-up flow, a job that fails and retries with correct backoff, and the Meta hashing unit tests.

Then report:
1. Every new table and cron entry
2. Which adapters are fully implemented vs `UNVERIFIED`, and exactly what each stub needs from me
3. Every new environment variable, in `.env.example`
4. Confirmation that placing an order still succeeds with all integrations disabled and with all of them failing
5. Anything you deferred, and why

Build it now, start to finish.

---

# PART B — Your to-do list

Do these after the build. Nothing here blocks development.

### Courier
- [ ] Open a **PostEx merchant account**, negotiate your rate card, get the **API token** from your account manager
- [ ] Add and verify your **pickup address** in the PostEx dashboard
- [ ] Open **Leopards** and **TCS** merchant accounts as backups, and ask each for their **API integration document PDF** — give those files to Claude Code to complete the `UNVERIFIED` adapters
- [ ] Sit down once and complete the **city mapping** in admin (30 minutes, done once, prevents most booking failures)
- [ ] Decide your COD remittance cycle with each courier and record it in settings

### WhatsApp
- [ ] Create a **Meta Business Manager** account for MARK (if you don't have one)
- [ ] Verify the business (needs NTN / business registration documents — start this early, it takes days)
- [ ] Set up **WhatsApp Business Platform**, add a phone number that is **not** already on the WhatsApp consumer app
- [ ] Create and submit these **utility templates** for approval: order placed, order confirmed, shipped with tracking, out for delivery, delivered, abandoned cart follow-up
- [ ] Get the **Phone Number ID**, **WABA ID**, and a permanent **System User access token**
- [ ] Set a monthly WhatsApp spend budget — pricing changes 1 October 2026

### Meta (Facebook + Instagram)
- [ ] Create the **MARK Facebook Page** and **Instagram Business account**, link both to Business Manager
- [ ] In **Commerce Manager**, create a catalog and add the feed URL `https://<your-domain>/feed/meta`, set to fetch hourly
- [ ] Create a **Pixel / Dataset**, copy the **Pixel ID** and generate a **Conversions API access token**
- [ ] Complete **domain verification** for your domain

### Google
- [ ] Create a **Google Merchant Center** account, verify and claim the domain
- [ ] Add the feed URL `https://<your-domain>/feed/google`
- [ ] Create a **GA4 property**, copy the **Measurement ID** and an **API secret** for the Measurement Protocol
- [ ] Add the site to **Search Console** and submit the sitemap

### TikTok
- [ ] Create a **TikTok Business Center** account and a **TikTok Ads** account
- [ ] Create a **Pixel**, copy the Pixel ID and generate an **Events API access token**
- [ ] Confirm whether **TikTok Shop** is available for Pakistani sellers before planning anything around it

### Before going live
- [ ] Rotate the admin password and the Neon connection string that were used during development
- [ ] Set a strong `ENCRYPTION_MASTER_KEY` and `JOBS_RUNNER_SECRET`
- [ ] Delete the two "Test Customer" orders
- [ ] `git init`, commit, push to a private repo
- [ ] Free up space on your C: drive
- [ ] Turn dry-run **off**, then place one real order to yourself and let it run the full cycle: booking, tracking, WhatsApp messages, delivery
