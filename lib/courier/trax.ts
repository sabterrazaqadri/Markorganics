import { createScaffoldAdapter } from "./scaffold";

/**
 * Trax — UNVERIFIED.
 *
 * Trax exposes a REST API to registered merchants only. Rather than guess an endpoint shape (a confidently wrong request
 * is worse than no request at all), this adapter satisfies the interface,
 * refuses every live call, and lists what it needs.
 *
 * TODO — supply from the Trax integration document:
 *   - Trax API base URL, and whether sandbox and production differ.
 *   - Authentication: header name, token format, and whether a login/token call is required first.
 *   - Create shipment: exact request field names, the city identifier format, and whether COD is sent in rupees or paisa.
 *   - Create shipment response: where the tracking number and (if any) label URL appear.
 *   - Track response: the full status vocabulary and the timestamp field on each scan.
 *   - Cancel shipment: endpoint, method, and what a successful cancel looks like.
 *   - City list and pickup-address endpoints, so the mapping table can be filled automatically.
 *   - Whether webhooks are offered, and how their signature is verified.
 */
export const TraxAdapter = createScaffoldAdapter({
  id: "trax",
  name: "Trax",
  todo: [
    "Trax API base URL, and whether sandbox and production differ.",
    "Authentication: header name, token format, and whether a login/token call is required first.",
    "Create shipment: exact request field names, the city identifier format, and whether COD is sent in rupees or paisa.",
    "Create shipment response: where the tracking number and (if any) label URL appear.",
    "Track response: the full status vocabulary and the timestamp field on each scan.",
    "Cancel shipment: endpoint, method, and what a successful cancel looks like.",
    "City list and pickup-address endpoints, so the mapping table can be filled automatically.",
    "Whether webhooks are offered, and how their signature is verified.",
  ],
});
