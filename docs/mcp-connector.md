# Markorganic MCP connector (Claude / ChatGPT ordering)

Endpoint: `https://www.markorganic.com/api/mcp` (Streamable HTTP, OAuth 2.1).

## Sign-in (WhatsApp, reverse OTP)

Every MCP request needs a bearer token. On first connect the assistant gets a
401 pointing at `/.well-known/oauth-protected-resource`, discovers
`/.well-known/oauth-authorization-server`, registers at `/oauth/register` (or
uses a client ID metadata document) and opens `/oauth/authorize`.

There the customer taps **Verify with WhatsApp**: WhatsApp opens with
`MARK LOGIN 12345678` already typed, they press Send, the WhatsApp webhook
(`lib/whatsapp/inbound.ts`) matches the code to the sender's number, replies
"✅ Verified", and the sign-in page (polling every 2 s) returns them to the
assistant. No Meta template or business verification is needed, and the number
is proven by WhatsApp itself. Codes live 10 minutes and are single use.

Tokens: access 1 hour, refresh 90 days (rotated on use), stored hashed
(`lib/oauth/core.ts`). The verified phone is attached to every tool call, so
customers never type it and only see their own orders.

### Setup

1. Tables: `docs/sql/2026-11-mcp-oauth.sql` (applied to production 2026-11-25).
2. The WhatsApp webhook must be live: in the Meta app, WhatsApp → Configuration,
   callback `https://www.markorganic.com/api/webhooks/whatsapp`, verify token and
   app secret matching Admin → Integrations → WhatsApp, and the **messages**
   field subscribed.
3. `OAUTH_WHATSAPP_NUMBER`: the Cloud API number customers write to (digits,
   e.g. `923001234567`). Defaults to the store contact phone.
4. Directory review: `OAUTH_REVIEW_PHONE` (e.g. `+923000000000`) and
   `OAUTH_REVIEW_CODE` (6 digits). Reviewers use "I have a login code" with
   these; nothing is sent, and their orders are noted "REVIEW TEST ORDER".
5. Optional, after Meta business verification: an approved Authentication
   template `mark_login_otp` plus `OAUTH_SEND_OTP=1` also lets customers receive
   a code instead of sending one.
6. Local development: `OAUTH_DEV_SHOW_OTP=1` shows send-codes on screen.

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
