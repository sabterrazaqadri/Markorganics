import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrationEvents } from "@/lib/db/schema";
import { recordHealth } from "./config";
import type { ProviderId } from "./registry";

/**
 * The single door every outbound integration call goes through.
 *
 * It does four things, and they are the reason no adapter ever calls fetch()
 * directly: it honours dry-run, it never throws, it logs the call with secrets
 * redacted, and it updates the provider's health so the dashboard can say
 * which integration is currently broken.
 */

export type IntegrationResult<T> =
  | { ok: true; data: T; status: number; dryRun: boolean; durationMs: number }
  | { ok: false; error: string; status: number | null; dryRun: boolean; durationMs: number; body?: unknown };

export interface CallOptions<T> {
  provider: ProviderId;
  /** Short verb used in the log and in error messages, e.g. "createShipment". */
  operation: string;
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  /** Query string appended to `url`. */
  query?: Record<string, string | number | undefined>;
  /**
   * The realistic fake returned when dry-run is on. Required: an adapter that
   * cannot describe its own success shape is not finished.
   */
  dryRunResponse: () => T;
  dryRun: boolean;
  /** Values scrubbed from the log wherever they appear. */
  secrets?: string[];
  timeoutMs?: number;
  jobId?: string;
  /** Interprets a 2xx body that still means failure. Return a message to fail. */
  failureMessage?: (body: unknown) => string | null;
  /** Expect a non-JSON response (labels, loadsheets). */
  raw?: boolean;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const REDACTED = "«redacted»";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "token",
  "x-api-key",
  "apikey",
  "api-key",
  "access-token",
  "x-access-token",
  "cookie",
  "x-hub-signature-256",
]);

const SENSITIVE_BODY_KEYS =
  /(token|secret|password|passwd|apikey|api_key|access_token|authorization|signature|credential)/i;

export function redactHeaders(headers: Record<string, string>, secrets: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SENSITIVE_HEADERS.has(k.toLowerCase()) ? REDACTED : scrub(v, secrets);
  }
  return out;
}

/** Deep copy with secret-looking keys blanked and known secret values removed. */
export function redactBody(value: unknown, secrets: string[] = [], depth = 0): unknown {
  if (depth > 6) return "«deep»";
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") return scrub(value, secrets);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactBody(v, secrets, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_BODY_KEYS.test(k) ? REDACTED : redactBody(v, secrets, depth + 1);
    }
    return out;
  }
  return String(value);
}

function scrub(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 6) out = out.split(secret).join(REDACTED);
  }
  return out;
}

function buildUrl(url: string, query?: Record<string, string | number | undefined>): string {
  if (!query) return url;
  const entries = Object.entries(query).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return url;
  const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
  return url.includes("?") ? `${url}&${qs}` : `${url}?${qs}`;
}

export async function callProvider<T>(opts: CallOptions<T>): Promise<IntegrationResult<T>> {
  const method = opts.method ?? "GET";
  const url = buildUrl(opts.url, opts.query);
  const headers = opts.headers ?? {};
  const started = Date.now();

  if (opts.dryRun) {
    const data = opts.dryRunResponse();
    const durationMs = Date.now() - started;
    await logCall({
      provider: opts.provider,
      operation: opts.operation,
      method,
      endpoint: url,
      requestHeaders: redactHeaders(headers, opts.secrets),
      requestBody: redactBody(opts.body, opts.secrets),
      responseStatus: 200,
      responseBody: redactBody(data, opts.secrets),
      ok: true,
      dryRun: true,
      durationMs,
      error: null,
      jobId: opts.jobId,
    });
    return { ok: true, data, status: 200, dryRun: true, durationMs };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let status: number | null = null;
  let parsed: unknown = null;
  let error: string | null = null;

  try {
    const response = await fetch(url, {
      method,
      headers: opts.body !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
      cache: "no-store",
    });
    status = response.status;

    if (opts.raw) {
      parsed = { bytes: (await response.arrayBuffer()).byteLength };
    } else {
      const text = await response.text();
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = { _text: text.slice(0, 2000) };
      }
    }

    if (!response.ok) {
      error = `${opts.provider} ${opts.operation} failed: HTTP ${response.status}`;
    } else if (opts.failureMessage) {
      error = opts.failureMessage(parsed);
    }
  } catch (err) {
    error =
      (err as Error).name === "AbortError"
        ? `${opts.provider} ${opts.operation} timed out after ${opts.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`
        : `${opts.provider} ${opts.operation} failed: ${(err as Error).message}`;
  } finally {
    clearTimeout(timer);
  }

  const durationMs = Date.now() - started;
  await logCall({
    provider: opts.provider,
    operation: opts.operation,
    method,
    endpoint: url,
    requestHeaders: redactHeaders(headers, opts.secrets),
    requestBody: redactBody(opts.body, opts.secrets),
    responseStatus: status,
    responseBody: redactBody(parsed, opts.secrets),
    ok: !error,
    dryRun: false,
    durationMs,
    error,
    jobId: opts.jobId,
  });
  await recordHealth(opts.provider, !error, error ?? undefined);

  if (error) return { ok: false, error, status, dryRun: false, durationMs, body: parsed };
  return { ok: true, data: parsed as T, status: status ?? 200, dryRun: false, durationMs };
}

/* ------------------------------------------------------------------ log */

export const EVENT_LOG_KEEP = 100;

interface LogInput {
  provider: string;
  operation: string;
  method: string;
  endpoint: string;
  requestHeaders?: unknown;
  requestBody?: unknown;
  responseStatus: number | null;
  responseBody?: unknown;
  ok: boolean;
  dryRun: boolean;
  durationMs: number;
  error: string | null;
  jobId?: string;
  direction?: "outbound" | "inbound";
}

/** Logging is best-effort: a failed insert must never fail the call itself. */
export async function logCall(input: LogInput): Promise<void> {
  try {
    await db.insert(integrationEvents).values({
      provider: input.provider,
      direction: input.direction ?? "outbound",
      operation: input.operation,
      method: input.method,
      endpoint: input.endpoint.slice(0, 2000),
      requestHeaders: (input.requestHeaders ?? null) as never,
      requestBody: (input.requestBody ?? null) as never,
      responseStatus: input.responseStatus,
      responseBody: (input.responseBody ?? null) as never,
      ok: input.ok,
      dryRun: input.dryRun,
      durationMs: input.durationMs,
      error: input.error?.slice(0, 2000) ?? null,
      jobId: input.jobId ?? null,
    });
    // Keep the log bounded without paying for a delete on every single call.
    if (Math.random() < 0.05) await pruneEvents(input.provider);
  } catch (err) {
    console.error("integration log failed", err);
  }
}

export async function pruneEvents(provider: string): Promise<void> {
  const cutoff = db
    .select({ createdAt: integrationEvents.createdAt })
    .from(integrationEvents)
    .where(eq(integrationEvents.provider, provider))
    .orderBy(sql`${integrationEvents.createdAt} DESC`)
    .limit(1)
    .offset(EVENT_LOG_KEEP);

  const [row] = await cutoff;
  if (!row) return;
  await db
    .delete(integrationEvents)
    .where(and(eq(integrationEvents.provider, provider), lt(integrationEvents.createdAt, row.createdAt)));
}
