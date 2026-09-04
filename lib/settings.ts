import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import {
  BRAND_NAME,
  DELIVERY_FEE_PAISA,
  FREE_SHIPPING_THRESHOLD_PAISA,
  SUPPORT_EMAIL,
  WHATSAPP_NUMBER,
} from "@/config/commerce";
import { ORDER_NUMBER_PREFIX } from "@/lib/order-number";
// Re-exported so server callers have one import, but defined outside this
// server-only module because the admin forms need the same constants.
import { WHATSAPP_TRIGGERS } from "@/config/whatsapp";

export { WHATSAPP_TRIGGERS, WHATSAPP_TRIGGER_LABEL, type WhatsappTrigger } from "@/config/whatsapp";

export const SETTINGS_TAG = "settings";

export interface StoreSettings {
  name: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  currency: string;
  timezone: string;
  orderNumberPrefix: string;
}

export interface CityRate {
  city: string;
  feePaisa: number;
}

export interface DeliverySettings {
  flatRatePaisa: number;
  freeThresholdPaisa: number;
  /** Overrides the flat rate for the named city. */
  cityRates: CityRate[];
  /** Checkout refuses these cities. */
  blockedCities: string[];
}

export interface IntegrationSettings {
  /** Master switch. When on, no outbound call leaves the building. */
  dryRun: boolean;
  /** Courier pre-selected on the order page. */
  defaultCourier: string;
  /** Put stock back on the shelf when a courier reports a return. */
  restockOnReturn: boolean;
  /** Delivered this many days ago with nothing remitted = flagged. */
  codRemittanceDays: number;
  /** How long after abandonment the WhatsApp follow-up is scheduled. */
  abandonedDelayHours: number;
  whatsappTriggers: Record<string, boolean>;
  /** Show the cookie banner and hold client pixels until it is accepted. */
  consentBanner: boolean;
}

export interface AllSettings {
  store: StoreSettings;
  delivery: DeliverySettings;
  integrations: IntegrationSettings;
}

/** config/commerce.ts stays the fallback, so a fresh database still behaves. */
export const DEFAULT_SETTINGS: AllSettings = {
  store: {
    name: BRAND_NAME,
    contactPhone: WHATSAPP_NUMBER,
    contactEmail: SUPPORT_EMAIL,
    address: "",
    currency: "PKR",
    timezone: "Asia/Karachi",
    orderNumberPrefix: ORDER_NUMBER_PREFIX,
  },
  delivery: {
    flatRatePaisa: DELIVERY_FEE_PAISA,
    freeThresholdPaisa: FREE_SHIPPING_THRESHOLD_PAISA,
    cityRates: [],
    blockedCities: [],
  },
  integrations: {
    // Safe by default: a fresh install sends nothing anywhere.
    dryRun: true,
    defaultCourier: "postex",
    restockOnReturn: true,
    codRemittanceDays: 7,
    abandonedDelayHours: 4,
    whatsappTriggers: Object.fromEntries(WHATSAPP_TRIGGERS.map((t) => [t, false])),
    consentBanner: true,
  },
};

function merge<T extends object>(fallback: T, stored: unknown): T {
  if (!stored || typeof stored !== "object") return fallback;
  return { ...fallback, ...(stored as Partial<T>) };
}

async function readSettings(): Promise<AllSettings> {
  const rows = await db.select().from(settings);
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const integrations = merge(DEFAULT_SETTINGS.integrations, byKey.get("integrations"));
  return {
    store: merge(DEFAULT_SETTINGS.store, byKey.get("store")),
    delivery: merge(DEFAULT_SETTINGS.delivery, byKey.get("delivery")),
    // A trigger absent from the stored object must read as off, not undefined.
    integrations: {
      ...integrations,
      whatsappTriggers: {
        ...DEFAULT_SETTINGS.integrations.whatsappTriggers,
        ...(integrations.whatsappTriggers ?? {}),
      },
    },
  };
}

const cachedSettings = unstable_cache(readSettings, ["settings"], {
  tags: [SETTINGS_TAG],
  revalidate: 300,
});

/**
 * Cached because the storefront reads delivery pricing on every cart render.
 * Invalidated by revalidateTag(SETTINGS_TAG) whenever settings are saved.
 *
 * unstable_cache needs a Next request context, and the job runner's own code
 * paths are also exercised by scripts and tests that have none. Rather than
 * make every caller care, a missing cache falls through to a direct read.
 */
export async function getSettings(): Promise<AllSettings> {
  try {
    return await cachedSettings();
  } catch (err) {
    if (isMissingCacheContext(err)) return readSettings();
    throw err;
  }
}

/** Next signals "no request context" with this invariant, not a typed error. */
export function isMissingCacheContext(err: unknown): boolean {
  return err instanceof Error && /incrementalCache|static generation store/i.test(err.message);
}

export async function getDeliverySettings(): Promise<DeliverySettings> {
  return (await getSettings()).delivery;
}

export async function getStoreSettings(): Promise<StoreSettings> {
  return (await getSettings()).store;
}

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  return (await getSettings()).integrations;
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value: value as never, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: value as never, updatedAt: new Date() } });
}

/** Pure: the same rule the storefront and the order transaction both apply. */
export function deliveryFeeWith(
  delivery: DeliverySettings,
  subtotalPaisa: number,
  city?: string | null,
): number {
  if (subtotalPaisa <= 0) return 0;
  if (subtotalPaisa >= delivery.freeThresholdPaisa) return 0;
  if (city) {
    const match = delivery.cityRates.find((r) => r.city.toLowerCase() === city.trim().toLowerCase());
    if (match) return Math.max(0, match.feePaisa);
  }
  return delivery.flatRatePaisa;
}

export function isCityBlocked(delivery: DeliverySettings, city: string): boolean {
  const needle = city.trim().toLowerCase();
  return delivery.blockedCities.some((c) => c.trim().toLowerCase() === needle);
}
