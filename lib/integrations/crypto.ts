import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM envelope encryption for integration credentials.
 *
 * Secrets are written to the database as { cipher, iv, tag, last4 } and are
 * only ever decrypted server-side, at the moment of an outbound call. The UI
 * receives `last4` and nothing else.
 *
 * A missing or malformed master key is not fatal: encryption is unavailable,
 * so credentials cannot be saved and every integration that needs one stays
 * disabled. Nothing throws into a page render or an order.
 */

export interface SecretEnvelope {
  cipher: string;
  iv: string;
  tag: string;
  last4: string;
}

const ALGO = "aes-256-gcm";

let cachedKey: Buffer | null | undefined;

/** 64 hex chars, or 44 base64 chars — either way, 32 bytes. */
function parseKey(raw: string): Buffer | null {
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === 32) return buf;
  } catch {
    /* fall through */
  }
  return null;
}

function masterKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  cachedKey = raw ? parseKey(raw) : null;
  if (raw && !cachedKey) {
    console.warn("ENCRYPTION_MASTER_KEY is set but is not 32 bytes of hex or base64. Credentials are disabled.");
  }
  return cachedKey;
}

/** Test seam: the key is read once per process, so tests must be able to reset it. */
export function resetKeyCache(): void {
  cachedKey = undefined;
}

export function encryptionAvailable(): boolean {
  return masterKey() !== null;
}

export class EncryptionUnavailableError extends Error {
  constructor() {
    super("ENCRYPTION_MASTER_KEY is not set, so credentials cannot be stored.");
    this.name = "EncryptionUnavailableError";
  }
}

export function encryptSecret(plain: string): SecretEnvelope {
  const key = masterKey();
  if (!key) throw new EncryptionUnavailableError();

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const out = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    cipher: out.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    last4: plain.slice(-4),
  };
}

/** Returns null rather than throwing: a rotated key must not break a page. */
export function decryptSecret(envelope: unknown): string | null {
  const key = masterKey();
  if (!key || !isEnvelope(envelope)) return null;
  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(envelope.iv, "base64"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(envelope.cipher, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function isEnvelope(value: unknown): value is SecretEnvelope {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.cipher === "string" && typeof v.iv === "string" && typeof v.tag === "string";
}

export function maskOf(envelope: unknown): string {
  if (!isEnvelope(envelope)) return "";
  const last4 = typeof (envelope as SecretEnvelope).last4 === "string" ? (envelope as SecretEnvelope).last4 : "";
  return last4 ? `••••${last4}` : "••••";
}
