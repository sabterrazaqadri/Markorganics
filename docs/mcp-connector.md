# Markorganic MCP connector (Claude / ChatGPT ordering)

Endpoint: `https://www.markorganic.com/api/mcp` (Streamable HTTP, no auth).

| Tool | What it does | Writes? |
|---|---|---|
| `search_products` | Keyword (English / Roman Urdu / Urdu), category, budget search | no |
| `get_product` | Full product details, variants, FAQs | no |
| `get_store_info` | Delivery fee, free-delivery threshold, payment methods, contact | no |
| `quote_order` | Exact cart total via the storefront's `quoteCart` | no |
| `place_order` | Real COD order via `placeOrderCore` (requires `customerConfirmed: true`) | yes |
| `track_order` | Order status by order number + phone | no |

Orders placed here go through the same transaction as the storefront
(`lib/orders/place-order.ts`): stock, discounts, delivery, customer stats,
WhatsApp and analytics jobs are identical. They are tagged `ai-order` plus
`ai-claude` / `ai-chatgpt` / `ai`, so they can be filtered in the admin.

Rate limits: 5 orders per phone per 10 minutes (the storefront limit), 60
orders per 10 minutes overall from the assistant, 20 tracking lookups per
phone per 10 minutes.

## Connect

- **Claude:** Settings → Connectors → Add custom connector → paste the URL.
- **ChatGPT:** Settings → Apps / Connectors → developer mode → create a connector with the URL.
- **Local test:** `npx @modelcontextprotocol/inspector` → `http://localhost:3000/api/mcp`.

Code: `app/api/mcp/route.ts` (route) and `lib/mcp/server.ts` (tools and instructions).
