import { createScaffoldAdapter } from "./scaffold";

/**
 * Leopards Courier — UNVERIFIED.
 *
 * Leopards publishes a merchant API but the request shapes differ per account tier, so nothing here is guessed. Rather than guess an endpoint shape (a confidently wrong request
 * is worse than no request at all), this adapter satisfies the interface,
 * refuses every live call, and lists what it needs.
 *
 * TODO — supply from the Leopards Courier integration document:
 *   - Leopards Courier API base URL, and whether sandbox and production differ.
 *   - Authentication: header name, token format, and whether a login/token call is required first.
 *   - Create shipment: exact request field names, the city identifier format, and whether COD is sent in rupees or paisa.
 *   - Create shipment response: where the tracking number and (if any) label URL appear.
 *   - Track response: the full status vocabulary and the timestamp field on each scan.
 *   - Cancel shipment: endpoint, method, and what a successful cancel looks like.
 *   - City list and pickup-address endpoints, so the mapping table can be filled automatically.
 *   - Whether webhooks are offered, and how their signature is verified.
 */
export const LeopardsAdapter = createScaffoldAdapter({
  id: "leopards",
  name: "Leopards Courier",
  todo: [
    "Leopards Courier API base URL, and whether sandbox and production differ.",
    "Authentication: header name, token format, and whether a login/token call is required first.",
    "Create shipment: exact request field names, the city identifier format, and whether COD is sent in rupees or paisa.",
    "Create shipment response: where the tracking number and (if any) label URL appear.",
    "Track response: the full status vocabulary and the timestamp field on each scan.",
    "Cancel shipment: endpoint, method, and what a successful cancel looks like.",
    "City list and pickup-address endpoints, so the mapping table can be filled automatically.",
    "Whether webhooks are offered, and how their signature is verified.",
  ],
});
