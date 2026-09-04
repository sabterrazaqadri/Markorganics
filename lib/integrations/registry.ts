/**
 * The provider catalogue.
 *
 * Field metadata lives here (not in the components) so the settings UI, the
 * credential encryptor and the .env.example generator all agree on exactly
 * which fields exist and which of them are secret.
 *
 * No "server-only" import: client components read this for labels.
 */

export const PROVIDERS = [
  "postex",
  "leopards",
  "tcs",
  "trax",
  "mp",
  "blueex",
  "whatsapp",
  "meta",
  "google",
  "tiktok",
] as const;

export type ProviderId = (typeof PROVIDERS)[number];

export type ProviderKind = "courier" | "messaging" | "analytics";

export interface ProviderField {
  key: string;
  label: string;
  secret: boolean;
  hint?: string;
  placeholder?: string;
  /** Rendered as a checkbox instead of a text input. */
  boolean?: boolean;
  /** Not needed for the provider to count as configured. */
  optional?: boolean;
}

export interface ProviderSpec {
  id: ProviderId;
  kind: ProviderKind;
  name: string;
  blurb: string;
  /** false = the request shapes are guesses and must be confirmed before use. */
  verified: boolean;
  /** What the adapter still needs before it can be switched on. Shown in admin. */
  todo?: string[];
  docs?: string;
  fields: ProviderField[];
}

const COURIER_TODO = (name: string) => [
  `${name} API base URL and environment (sandbox vs production).`,
  "Authentication scheme: header name, token format, and whether a login call is required first.",
  "Create-shipment request body: exact field names, city identifier format, COD amount unit (rupees or paisa).",
  "Create-shipment response: where the tracking number and label URL appear.",
  "Track response: status vocabulary and the timestamp field for each scan.",
  "Cancel-shipment endpoint and its success response.",
  "City list and pickup-address endpoints.",
];

export const PROVIDER_SPECS: Record<ProviderId, ProviderSpec> = {
  postex: {
    id: "postex",
    kind: "courier",
    name: "PostEx",
    blurb: "Merchant API v4.1.9. Cities, pickup addresses, booking, tracking and cancellation.",
    verified: true,
    docs: "https://api.postex.pk",
    fields: [
      { key: "apiToken", label: "API token", secret: true, hint: "From your PostEx account manager. Sent as the `token` header." },
      { key: "baseUrl", label: "Base URL", secret: false, placeholder: "https://api.postex.pk", hint: "Leave blank for the production host." },
      { key: "defaultPickupCode", label: "Default pickup address code", secret: false, hint: "Used when the order page does not pick one." },
      { key: "orderType", label: "Order type", secret: false, placeholder: "Normal", hint: "PostEx order type. Normal, Reverse or Replacement." },
    ],
  },
  leopards: {
    id: "leopards",
    kind: "courier",
    name: "Leopards Courier",
    blurb: "Scaffolded against the shared courier interface. Request shapes are not implemented.",
    verified: false,
    todo: COURIER_TODO("Leopards"),
    fields: [
      { key: "apiKey", label: "API key", secret: true },
      { key: "apiPassword", label: "API password", secret: true },
      { key: "baseUrl", label: "Base URL", secret: false, placeholder: "https://merchantapi.leopardscourier.com" },
    ],
  },
  tcs: {
    id: "tcs",
    kind: "courier",
    name: "TCS",
    blurb: "Scaffolded against the shared courier interface. Request shapes are not implemented.",
    verified: false,
    todo: COURIER_TODO("TCS"),
    fields: [
      { key: "clientId", label: "Client ID", secret: false },
      { key: "apiKey", label: "API key", secret: true },
      { key: "username", label: "Username", secret: false },
      { key: "password", label: "Password", secret: true },
      { key: "baseUrl", label: "Base URL", secret: false },
    ],
  },
  trax: {
    id: "trax",
    kind: "courier",
    name: "Trax",
    blurb: "Scaffolded against the shared courier interface. Request shapes are not implemented.",
    verified: false,
    todo: COURIER_TODO("Trax"),
    fields: [
      { key: "apiToken", label: "API token", secret: true },
      { key: "baseUrl", label: "Base URL", secret: false },
    ],
  },
  mp: {
    id: "mp",
    kind: "courier",
    name: "M&P",
    blurb: "Scaffolded against the shared courier interface. Request shapes are not implemented.",
    verified: false,
    todo: COURIER_TODO("M&P"),
    fields: [
      { key: "username", label: "Username", secret: false },
      { key: "password", label: "Password", secret: true },
      { key: "accountNumber", label: "Account number", secret: false },
      { key: "baseUrl", label: "Base URL", secret: false },
    ],
  },
  blueex: {
    id: "blueex",
    kind: "courier",
    name: "BlueEx",
    blurb: "Scaffolded against the shared courier interface. Request shapes are not implemented.",
    verified: false,
    todo: COURIER_TODO("BlueEx"),
    fields: [
      { key: "username", label: "Username", secret: false },
      { key: "password", label: "Password", secret: true },
      { key: "accountId", label: "Account ID", secret: false },
      { key: "baseUrl", label: "Base URL", secret: false },
    ],
  },
  whatsapp: {
    id: "whatsapp",
    kind: "messaging",
    name: "WhatsApp Cloud API",
    blurb: "Order lifecycle notifications and inbound messages through Meta's Cloud API.",
    verified: true,
    docs: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    fields: [
      { key: "accessToken", label: "System user access token", secret: true, hint: "Permanent token from a Meta system user." },
      { key: "phoneNumberId", label: "Phone number ID", secret: false },
      { key: "wabaId", label: "WhatsApp Business Account ID", secret: false },
      { key: "appSecret", label: "App secret", secret: true, hint: "Verifies the X-Hub-Signature-256 on inbound webhooks." },
      { key: "verifyToken", label: "Webhook verify token", secret: true, hint: "Any random string. Paste the same value into Meta's webhook setup." },
      { key: "graphVersion", label: "Graph API version", secret: false, placeholder: "v21.0" },
    ],
  },
  meta: {
    id: "meta",
    kind: "analytics",
    name: "Meta Pixel & Conversions API",
    blurb: "Browser pixel plus server-side events, deduplicated on a shared event_id.",
    verified: true,
    docs: "https://developers.facebook.com/docs/marketing-api/conversions-api",
    fields: [
      { key: "accessToken", label: "Conversions API access token", secret: true },
      { key: "pixelId", label: "Pixel / dataset ID", secret: false },
      { key: "testEventCode", label: "Test event code", secret: false, hint: "Optional. Sends events to Events Manager's test tab." },
      { key: "graphVersion", label: "Graph API version", secret: false, placeholder: "v21.0" },
    ],
  },
  google: {
    id: "google",
    kind: "analytics",
    name: "Google Analytics 4",
    blurb: "GA4 tag plus Measurement Protocol server events, and the Search Console verification tag.",
    verified: true,
    docs: "https://developers.google.com/analytics/devguides/collection/protocol/ga4",
    fields: [
      { key: "apiSecret", label: "Measurement Protocol API secret", secret: true },
      { key: "measurementId", label: "Measurement ID", secret: false, placeholder: "G-XXXXXXXXXX" },
      { key: "searchConsoleToken", label: "Search Console verification token", secret: false, hint: "The content value of the google-site-verification meta tag." },
    ],
  },
  tiktok: {
    id: "tiktok",
    kind: "analytics",
    name: "TikTok Pixel & Events API",
    blurb: "Browser pixel plus server events. TikTok Shop is deliberately out of scope.",
    verified: true,
    docs: "https://business-api.tiktok.com/portal/docs",
    fields: [
      { key: "accessToken", label: "Events API access token", secret: true },
      { key: "pixelCode", label: "Pixel code", secret: false },
      { key: "advertiserId", label: "Advertiser ID", secret: false, hint: "Used only by the Test connection button." },
      { key: "testEventCode", label: "Test event code", secret: false, hint: "Optional." },
    ],
  },
};

/**
 * Every courier gets the same webhook secret field, so /api/webhooks/courier/
 * [provider] can verify a push the day a courier starts offering one.
 */
for (const spec of Object.values(PROVIDER_SPECS)) {
  if (spec.kind !== "courier") continue;
  spec.fields.push({
    key: "webhookSecret",
    label: "Webhook shared secret",
    secret: true,
    optional: true,
    hint: "Optional. Set this and give the courier the same value to accept status webhooks.",
  });
}

export const PROVIDER_LIST: ProviderSpec[] = PROVIDERS.map((id) => PROVIDER_SPECS[id]);

export const COURIER_PROVIDERS = PROVIDER_LIST.filter((p) => p.kind === "courier").map((p) => p.id);

export function isProvider(value: string): value is ProviderId {
  return (PROVIDERS as readonly string[]).includes(value);
}

export function providerName(id: string): string {
  return isProvider(id) ? PROVIDER_SPECS[id].name : id;
}

/** Secret fields that must be present before the provider counts as configured. */
export function secretFields(id: ProviderId): string[] {
  return PROVIDER_SPECS[id].fields.filter((f) => f.secret && !f.optional).map((f) => f.key);
}

export function allSecretFields(id: ProviderId): string[] {
  return PROVIDER_SPECS[id].fields.filter((f) => f.secret).map((f) => f.key);
}
