/**
 * Admin session cookie helpers.
 *
 * Everything in this file uses Web Crypto only, so it runs in both the Edge
 * middleware and the Node runtime. Database-backed session checks live in
 * lib/admin-session.ts (Node only).
 *
 * Cookie format: <sessionId>.<expiresAtUnixSeconds>.<hmacHex>
 */
export const ADMIN_COOKIE = "mrk_admin";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const encoder = new TextEncoder();

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_SESSION_SECRET must be set to at least 16 characters.");
  }
  return s;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export async function sha256Hex(message: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(message)));
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSessionCookie(sessionId: string, expiresAt: number): Promise<string> {
  const payload = `${sessionId}.${expiresAt}`;
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export interface VerifiedSession {
  sessionId: string;
  expiresAt: number;
}

/** Verifies signature and expiry only. Does not consult the database. */
export async function verifySessionCookie(value: string | undefined | null): Promise<VerifiedSession | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [sessionId, expStr, sig] = parts;
  const expiresAt = Number(expStr);
  if (!/^[0-9a-f]{64}$/.test(sessionId) || !Number.isFinite(expiresAt)) return null;
  if (expiresAt * 1000 < Date.now()) return null;
  const expected = await hmac(`${sessionId}.${expiresAt}`);
  if (!timingSafeEqual(expected, sig)) return null;
  return { sessionId, expiresAt };
}
