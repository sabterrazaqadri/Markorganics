import "server-only";
import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrations, type Integration } from "@/lib/db/schema";
import {
  decryptSecret,
  encryptSecret,
  encryptionAvailable,
  isEnvelope,
  maskOf,
} from "./crypto";
import {
  PROVIDER_SPECS,
  isProvider,
  secretFields,
  type ProviderId,
} from "./registry";

export const INTEGRATIONS_TAG = "integrations";

/** Non-secret view of a provider. Safe to hand to a client component. */
export interface PublicIntegration {
  provider: ProviderId;
  isEnabled: boolean;
  dryRun: boolean;
  /** Effective dry-run, after the global master switch. */
  effectiveDryRun: boolean;
  configured: boolean;
  config: Record<string, string>;
  masked: Record<string, string>;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  lastSuccessAt: string | null;
}

/** Everything an adapter needs to make a call. Never leaves the server. */
export interface ResolvedCredentials {
  provider: ProviderId;
  isEnabled: boolean;
  dryRun: boolean;
  configured: boolean;
  /** Config values and decrypted secrets, flattened. */
  values: Record<string, string>;
}

function envFallback(provider: ProviderId, key: string): string {
  const name = `${provider.toUpperCase()}_${key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}`;
  return process.env[name] ?? "";
}

function readConfig(row: Integration | undefined): Record<string, string> {
  const raw = (row?.config ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw))
    out[k] = typeof v === "string" ? v : String(v ?? "");
  return out;
}

async function readRow(provider: ProviderId): Promise<Integration | undefined> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, provider))
    .limit(1);
  return row;
}

/**
 * Everything a call needs, with secrets decrypted.
 *
 * A provider with no row, no credentials, or an unreadable key comes back
 * `configured: false` and `dryRun: true`. Callers never have to guard: the
 * HTTP layer refuses to make a live call in that state.
 */
export async function resolveCredentials(
  provider: ProviderId,
): Promise<ResolvedCredentials> {
  const row = await readRow(provider);
  const spec = PROVIDER_SPECS[provider];
  const values = readConfig(row);
  const secrets = (row?.secrets ?? {}) as Record<string, unknown>;

  for (const field of spec.fields) {
    if (!field.secret) {
      if (!values[field.key])
        values[field.key] = envFallback(provider, field.key);
      continue;
    }
    const decrypted = decryptSecret(secrets[field.key]);
    values[field.key] = decrypted ?? envFallback(provider, field.key);
  }

  const required = secretFields(provider);
  const configured =
    required.length === 0 || required.every((k) => Boolean(values[k]));
  const globalDry = await globalDryRun();

  return {
    provider,
    isEnabled: Boolean(row?.isEnabled),
    // Never make a live call without credentials, whatever the toggles say.
    dryRun: globalDry || (row ? row.dryRun : true) || !configured,
    configured,
    values,
  };
}

export async function getPublicIntegration(
  provider: ProviderId,
): Promise<PublicIntegration> {
  const row = await readRow(provider);
  return toPublic(provider, row, await globalDryRun());
}

export async function listPublicIntegrations(): Promise<PublicIntegration[]> {
  const rows = await db.select().from(integrations);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  const globalDry = await globalDryRun();
  return (Object.keys(PROVIDER_SPECS) as ProviderId[]).map((id) =>
    toPublic(id, byProvider.get(id), globalDry),
  );
}

function toPublic(
  provider: ProviderId,
  row: Integration | undefined,
  globalDry: boolean,
): PublicIntegration {
  const spec = PROVIDER_SPECS[provider];
  const secrets = (row?.secrets ?? {}) as Record<string, unknown>;
  const config = readConfig(row);
  const masked: Record<string, string> = {};

  for (const field of spec.fields) {
    if (!field.secret) {
      if (!config[field.key])
        config[field.key] = envFallback(provider, field.key);
      continue;
    }
    masked[field.key] = isEnvelope(secrets[field.key])
      ? maskOf(secrets[field.key])
      : envFallback(provider, field.key)
        ? "••••(env)"
        : "";
  }

  const required = secretFields(provider);
  const configured =
    required.length === 0 || required.every((k) => Boolean(masked[k]));

  return {
    provider,
    isEnabled: Boolean(row?.isEnabled),
    dryRun: row ? row.dryRun : true,
    effectiveDryRun: globalDry || (row ? row.dryRun : true) || !configured,
    configured,
    config,
    masked,
    lastTestAt: row?.lastTestAt?.toISOString() ?? null,
    lastTestOk: row?.lastTestOk ?? null,
    lastTestMessage: row?.lastTestMessage ?? null,
    lastErrorAt: row?.lastErrorAt?.toISOString() ?? null,
    lastErrorMessage: row?.lastErrorMessage ?? null,
    lastSuccessAt: row?.lastSuccessAt?.toISOString() ?? null,
  };
}

async function readStorefrontIntegrations() {
  const rows = await db.select().from(integrations);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  const pick = (id: ProviderId, key: string) => {
    const row = byProvider.get(id);
    if (!row?.isEnabled) return "";
    const value = readConfig(row)[key] || envFallback(id, key);
    return value;
  };
  return {
    metaPixelId: pick("meta", "pixelId"),
    ga4MeasurementId:
      pick("google", "measurementId") || process.env.NEXT_PUBLIC_GA_ID || "",
    tiktokPixelCode: pick("tiktok", "pixelCode"),
    searchConsoleToken: pick("google", "searchConsoleToken"),
  };
}

const cachedStorefrontIntegrations = unstable_cache(
  readStorefrontIntegrations,
  ["storefront-integrations"],
  {
    tags: [INTEGRATIONS_TAG],
    revalidate: 300,
  },
);

/**
 * Public, cached slice used by the storefront to decide which pixels to
 * render. Contains ids only — never a token, never a secret.
 *
 * Falls through to a direct read outside a Next request context, so scripts
 * and tests are not forced to fake one.
 */
export async function getStorefrontIntegrations() {
  try {
    return await cachedStorefrontIntegrations();
  } catch (err) {
    const { isMissingCacheContext } = await import("@/lib/settings");
    if (isMissingCacheContext(err)) return readStorefrontIntegrations();
    throw err;
  }
}

/* --------------------------------------------------------------- writing */

export interface SaveIntegrationInput {
  provider: ProviderId;
  isEnabled?: boolean;
  dryRun?: boolean;
  config?: Record<string, string>;
  /** Only fields the user actually retyped. Blank means "leave as is". */
  secrets?: Record<string, string>;
  /** Fields to wipe. */
  clearSecrets?: string[];
}

export async function saveIntegration(
  input: SaveIntegrationInput,
): Promise<void> {
  const spec = PROVIDER_SPECS[input.provider];
  const row = await readRow(input.provider);

  const config = { ...readConfig(row) };
  for (const field of spec.fields) {
    if (field.secret) continue;
    const next = input.config?.[field.key];
    if (next !== undefined) config[field.key] = next.trim();
  }

  const secrets = { ...((row?.secrets ?? {}) as Record<string, unknown>) };
  for (const field of spec.fields) {
    if (!field.secret) continue;
    if (input.clearSecrets?.includes(field.key)) {
      delete secrets[field.key];
      continue;
    }
    const next = input.secrets?.[field.key];
    if (next === undefined || next.trim() === "") continue;
    if (!encryptionAvailable()) {
      throw new Error(
        "Set ENCRYPTION_MASTER_KEY before saving credentials. Nothing was written.",
      );
    }
    secrets[field.key] = encryptSecret(next.trim());
  }

  const values = {
    isEnabled: input.isEnabled ?? row?.isEnabled ?? false,
    dryRun: input.dryRun ?? row?.dryRun ?? true,
    config: config as never,
    secrets: secrets as never,
    updatedAt: new Date(),
  };

  await db
    .insert(integrations)
    .values({ provider: input.provider, ...values })
    .onConflictDoUpdate({ target: integrations.provider, set: values });
}

export async function recordTestResult(
  provider: ProviderId,
  ok: boolean,
  message: string,
): Promise<void> {
  await db
    .insert(integrations)
    .values({
      provider,
      lastTestAt: new Date(),
      lastTestOk: ok,
      lastTestMessage: message.slice(0, 1000),
    })
    .onConflictDoUpdate({
      target: integrations.provider,
      set: {
        lastTestAt: new Date(),
        lastTestOk: ok,
        lastTestMessage: message.slice(0, 1000),
      },
    });
}

/** Called by the HTTP layer after every live call, so the health strip is honest. */
export async function recordHealth(
  provider: string,
  ok: boolean,
  message?: string,
): Promise<void> {
  if (!isProvider(provider)) return;
  const now = new Date();
  const set = ok
    ? { lastSuccessAt: now, lastErrorAt: null, lastErrorMessage: null }
    : {
        lastErrorAt: now,
        lastErrorMessage: (message ?? "Unknown error").slice(0, 1000),
      };
  try {
    await db
      .insert(integrations)
      .values({ provider, ...set })
      .onConflictDoUpdate({ target: integrations.provider, set });
  } catch (err) {
    console.error("recordHealth failed", err);
  }
}

/* ------------------------------------------------------- global dry-run */

/**
 * Read straight from `settings` rather than through lib/settings so this
 * module stays importable from the job runner without pulling in the cached
 * storefront settings graph.
 */
async function globalDryRun(): Promise<boolean> {
  const { getIntegrationSettings } = await import("@/lib/settings");
  return (await getIntegrationSettings()).dryRun;
}
