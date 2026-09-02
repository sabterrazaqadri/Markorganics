# MARK — Admin build (Claude Code prompt)

> Copy everything below the line into Claude Code in the existing MARK project.

---

Build out `/admin` into a full commerce back office, modelled on Shopify's admin. The storefront is finished and must not regress. Payments and courier/app integrations are explicitly out of scope for this pass — leave clean seams where they'll plug in later, but build nothing for them.

Work through every module below. Don't stop to ask unless something genuinely contradicts existing code.

## Ground rules

1. **Additive migrations only.** Existing orders, products, and variants keep working. Where a module needs data that doesn't exist yet (customers, for example), write a backfill script that derives it from existing rows.
2. **Admin is not the storefront.** It's a dense, utilitarian tool: compact rows, small type, tables over cards, information over atmosphere. Do not reuse the apothecary look, the color bands, or the display font. Use a neutral grey/white UI with the three family colors appearing only as small product-family dots.
3. **Zero admin code in the storefront bundle.** Keep `/admin` in its own route group; verify no admin chunk leaks into public routes.
4. **Everything server-side.** Filtering, sorting, searching, and pagination all happen in Postgres — never fetch all rows and filter in the browser. Every list is paginated (cursor-based) and every filterable column is indexed.
5. **Every mutation is a Server Action** validated with Zod, wrapped in a transaction where it touches more than one table, and written to the audit log (§9).
6. Allowed new deps: `@tanstack/react-table` (headless only), `argon2` or `bcrypt`, `date-fns`, `papaparse`. Nothing else — keep building the UI components yourself.

## 1. Staff accounts and permissions

Replace the single `ADMIN_PASSWORD` with real accounts.

- `users` table: email, hashed password, name, role, status, last login, created by
- Roles: **Owner** (everything, including staff management and settings), **Manager** (orders, products, customers, discounts, content — no settings, no staff), **Staff** (orders and customers only, read-only on products)
- Session table with httpOnly signed cookies, expiry, and a "sign out all devices" action
- Seed one Owner from env vars on first run; if any user exists, the seed is a no-op
- Enforce permissions in the Server Actions themselves, not only by hiding UI. Write a `requireRole()` helper and use it in every mutation.
- Rate limit login attempts per email and per IP; lock an account for 15 minutes after 10 failures

## 2. Orders

Extend the existing orders module:

- **Saved views** as tabs: All, Unfulfilled, Pending, Shipped, Delivered, Cancelled, Returned — plus user-created saved filters
- **Filters:** status, date range, city, order value range, item count, tag, staff who last touched it
- **Bulk actions:** change status, add tag, export selected, print packing slips
- **Order detail** additions: full activity timeline (every status change, note, and edit with who and when), customer tags visible inline, link to the customer profile, and previous orders from the same phone number
- **Order editing:** change quantities, remove a line, add a line, apply a manual discount, adjust the delivery fee — all before the order ships. Every edit restores or deducts stock correctly and appends a timeline entry showing the before/after totals.
- **Draft orders:** create an order manually (phone orders, wholesale, replacements), pick a customer or enter a new one, add line items, apply a discount, then convert to a real order. Drafts don't reserve stock.
- **Abandoned checkouts:** log checkout attempts that were started but not submitted (name/phone captured, cart contents, timestamp). List them with a `wa.me` link to follow up. This is the single highest-value feature for a COD store in Pakistan — build it properly.
- **Packing slip:** clean print stylesheet at `/admin/orders/[id]/print`, A5, with order number, items, address, phone, COD amount payable, and a barcode of the order number

## 3. Products, collections, inventory

- **Product statuses:** Active, Draft, Archived. Only Active shows on the storefront.
- **Organization fields:** product type, vendor, tags. Filterable everywhere.
- **Collections:** manual (hand-pick products, drag to reorder) and automatic (rule-based — tag equals, price less than, product type is, stock greater than, with all/any matching). Automatic collections re-evaluate on product save. Collections get their own storefront route later; for now just manage them and expose them in the API.
- **Media library** at `/admin/files`: upload, search, reuse across products, alt text on every image, delete with a warning listing where the file is used
- **Inventory:** dedicated view across all variants — current stock, committed (in unfulfilled orders), available. Inline stock edit with a reason (Recount, Damaged, Received, Correction, Theft). Every change writes to an `inventory_adjustments` table with quantity delta, reason, note, and user. Show the full history per variant.
- **Low stock threshold** per variant, with a dashboard warning and a filterable "Low stock" view
- **Bulk edit:** select products, edit price / compare-at price / stock / status / tags for many at once in an editable grid
- **CSV import and export** for products and variants, with a dry-run preview showing what will be created, updated, and skipped, and a row-level error report. Never partially apply a bad import — validate the whole file first.
- **Metafields:** a simple key/value/type system (text, number, rich text, boolean, file) definable per product, so MARK can add fields like shelf life or certification without a schema change

## 4. Customers

Customers don't exist yet — create them.

- `customers` table keyed on the normalized `+92` phone number, since that's the reliable identity for COD in Pakistan (email is optional and often absent)
- **Backfill** from every existing order; merge orders sharing a phone number into one customer
- Auto-create or attach on every new order
- **Customer detail:** contact info, addresses used, all orders, lifetime spend, order count, average order value, first and last order date, cancellation and return counts, tags, and internal notes
- **The COD metric that matters:** a delivery success rate per customer (delivered ÷ total orders). Surface a clear warning on any new order from a customer with repeated returns or refusals, since that's the main way a COD store loses money.
- **Segments:** saved rule-based groups (spent over X, ordered more than N times, bought a specific product, from a specific city, no order in 90 days, high return rate). Segments are live queries, not frozen lists.
- **Merge duplicates** where the same person used two phone numbers
- Export a segment to CSV

## 5. Discounts

- **Code discounts** and **automatic discounts**
- Types: percentage off, fixed amount off, free delivery, buy X get Y
- Applies to: entire order, specific products, or specific collections
- Conditions: minimum order value, minimum quantity, first-time customers only, specific customer segment
- Limits: total usage cap, one-per-customer, start and end dates
- Track and display usage count and revenue attributed to each discount
- Storefront: add a discount code field to the cart and checkout. **Validate and recalculate the discount server-side inside the order transaction** — never trust a discount amount sent from the browser.

## 6. Content

- **Pages:** the existing static pages become database-backed and editable, with slug, title, body (rich text), SEO title and description, and published/draft state
- **Blog:** posts with excerpt, cover image, author, tags, publish date, scheduled publishing, and a storefront `/blog` index and post route
- **Navigation:** build the header and footer menus in the admin — nested items, drag to reorder, link to any collection, product, page, or custom URL. The storefront reads menus from the database with a long cache.

## 7. Analytics

Real queries against the orders table, not placeholders. One page with a date-range picker (today, 7d, 30d, 90d, custom) and a comparison to the previous period on every metric.

- Sales over time (line), orders over time, average order value
- Top products and top variants by revenue and by units
- Orders and revenue by city (this drives courier and stocking decisions)
- Order status funnel, and the **delivery success rate** — the COD equivalent of a conversion rate
- Cancellation and return rate, with reasons
- New vs returning customers, repeat purchase rate
- Discount performance
- Every report exportable to CSV

Cache aggregate queries for 5 minutes. If any report takes more than 300ms, add the index it needs.

## 8. Settings

- Store details: name, contact phone and email, address, currency, timezone (Asia/Karachi), order number prefix
- Delivery: flat rate, free-shipping threshold, optional per-city rates, and a list of cities you don't deliver to. Move the values currently hard-coded in `config/commerce.ts` into the database, keeping the config file as the fallback default.
- Policies: refund, privacy, terms, shipping — edited here, rendered on the storefront
- Notification templates: editable text for order placed, confirmed, shipped, delivered. **Store and preview them only — do not send anything.** WhatsApp and email wiring comes later.
- Staff management (Owner only)
- Danger zone: export a full database backup as JSON

## 9. Cross-cutting

- **Audit log** at `/admin/activity`: every mutation with user, action, entity, before/after diff, timestamp, IP. Filterable. This is not optional — with multiple staff on a COD store it's how disputes get settled.
- **Global search** (Cmd/Ctrl+K): orders by number or phone, products by name or SKU, customers by name or phone
- **Soft deletes** everywhere. Nothing is ever hard-deleted except media files.
- **Optimistic UI** on status changes and inline edits, with rollback and a clear error toast on failure
- Empty states that say what to do next; loading skeletons that match the real layout so nothing shifts
- Fully keyboard operable: tab order, focus rings, Escape closes modals, Enter submits

## Deliverables

When done, report:
1. New tables and migrations, and confirmation that the backfills ran
2. Route list for `/admin` with first-load JS, and confirmation that no admin code appears in storefront chunks
3. The permission matrix as actually implemented, per role per action
4. Which storefront files changed and why
5. Anything you deferred or simplified, and what it would take to finish

Build it now, start to finish.
