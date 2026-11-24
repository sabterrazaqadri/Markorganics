# Markorganic MCP connector (Claude / ChatGPT ordering)

Endpoint: `https://www.markorganic.com/api/mcp` (Streamable HTTP, OAuth 2.1).

## Sign-in (WhatsApp OTP)

Every MCP request needs a bearer token. On first connect the assistant gets a
401 pointing at `/.well-known/oauth-protected-resource`, discovers
`/.well-known/oauth-authorization-server`, registers itself at
`/oauth/register` (or uses a client ID metadata document), and opens
`/oauth/authorize`. The customer enters their WhatsApp number, receives a
6-digit code via the `mark_login_otp` template, and is sent back to the
assistant. Tokens: access 1 hour, refresh 90 days (rotated on use), all stored
hashed (`lib/oauth/core.ts`). The verified phone is attached to every tool
call, so customers never type it and can only see their own orders.

Before going live:
1. Create the tables: `docs/sql/2026-11-mcp-oauth.sql` (or `npm run db:push`).
2. In Meta Business Manager create an **Authentication** template named
   `mark_login_otp` (English, "Copy code" button) and wait for approval.
3. Admin → Integrations → WhatsApp templates: add `mark_login_otp`, category
   authentication, status approved. Keep the WhatsApp integration out of dry run.
   (`WHATSAPP_OTP_TEMPLATE` overrides the template name.)
4. Local development: `OAUTH_DEV_SHOW_OTP=1` shows the code on screen instead
   of sending it (ignored in production).

| Tool | What it does | Writes? |
|---|---|---|
| `search_products` | Keyword (English / Roman Urdu / Urdu), category, budget search | no |
| `get_product` | Full product details, variants, FAQs | no |
| `get_store_info` | Delivery fee, free-delivery threshold, payment methods, contact | no |
| `quote_order` | Exact cart total via the storefront's `quoteCart` | no |
| `place_order` | Real COD order via `placeOrderCore` for the signed-in phone (requires `customerConfirmed: true`) | yes |
| `my_account` | Saved name, city, last address and 5 recent orders of the signed-in customer | no |
| `track_order` | One of the signed-in customer's orders (latest if no number given) | no |

Orders placed here go through the same transaction as the storefront
(`lib/orders/place-order.ts`): stock, discounts, delivery, customer stats,
WhatsApp and analytics jobs are identical. They are tagged `ai-order` plus
`ai-claude` / `ai-chatgpt` / `ai`, so they can be filtered in the admin.

Rate limits: 5 orders per phone per 10 minutes (the storefront limit), 60
orders per 10 minutes overall from the assistant, 20 tracking lookups per
phone per 10 minutes.

## Connect

- **Claude:** Settings → Connectors → Add custom connector → paste the URL.
- **ChatGPT:** Settings → Apps / Connectors → developer mode → create a connector with the URL, Authentication: OAuth.
- **Local test:** `npx @modelcontextprotocol/inspector` → `http://localhost:3000/api/mcp`.

Code: `app/api/mcp/route.ts` (route) and `lib/mcp/server.ts` (tools and instructions).
