/** Unambiguous alphabet: no 0/O, 1/I/L. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const ORDER_NUMBER_PREFIX = "MRK-";
export const ORDER_NUMBER_REGEX = /^[A-Z0-9-]{0,10}[A-Z0-9]{6}$/;

export function generateOrderNumber(prefix: string = ORDER_NUMBER_PREFIX): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return prefix + out;
}

/**
 * Accepts "mrk-abc123", "ABC123", " MRK-ABC123 " and returns canonical form.
 * The prefix is configurable in settings, so the caller passes the current one
 * and the bare six-character body is always accepted.
 */
export function normalizeOrderNumber(input: string, prefix: string = ORDER_NUMBER_PREFIX): string | null {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return null;
  const upperPrefix = prefix.toUpperCase();
  const withPrefix = cleaned.startsWith(upperPrefix) ? cleaned : upperPrefix + cleaned;
  const body = withPrefix.slice(upperPrefix.length);
  if (!/^[A-Z0-9]{6}$/.test(body)) return null;
  return withPrefix;
}
