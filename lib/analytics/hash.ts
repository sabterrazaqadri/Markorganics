import { createHash } from "node:crypto";

/**
 * Meta's advanced-matching normalisation, then SHA-256.
 *
 * This is the part everyone gets wrong: the hash is only useful if the value
 * was normalised exactly as Meta specifies first, and a mismatch is silent —
 * the event is accepted and simply never matches a person. Hence the unit
 * tests in tests/meta-hash.test.ts.
 *
 * Rules implemented (Meta Conversions API customer information parameters):
 *   em  email      trim, lowercase
 *   ph  phone      digits only, country code included, no leading + or zeros
 *   fn/ln names    trim, lowercase, strip punctuation, digits and whitespace
 *   ct  city       lowercase, letters only (spaces and punctuation removed)
 *   st  state      lowercase, letters only
 *   zp  zip        lowercase, no whitespace
 *   country        lowercase two-letter ISO code
 *   external_id    hashed as-is after trimming, no lowercasing
 */

export type MatchField = "em" | "ph" | "fn" | "ln" | "ct" | "st" | "zp" | "country" | "external_id";

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Phone numbers keep their country code and lose everything else. A Pakistani
 * "0300 1234567" is meaningless to Meta without the 92, so a local number is
 * promoted before the digits are taken.
 */
export function normalizePhoneForMeta(raw: string, defaultCountryCode = "92"): string {
  let value = raw.trim();
  if (value.startsWith("+")) value = value.slice(1);
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("00")) digits = digits.slice(2);
  // 03001234567 -> 923001234567
  if (digits.startsWith("0")) digits = defaultCountryCode + digits.replace(/^0+/, "");
  return digits;
}

export function normalizeMatchValue(field: MatchField, raw: string): string {
  const value = (raw ?? "").trim();
  if (!value) return "";

  switch (field) {
    case "em":
      return value.toLowerCase();
    case "ph":
      return normalizePhoneForMeta(value);
    case "fn":
    case "ln":
      // Letters only: "Sabter Iqbal Jr." -> "sabteriqbaljr"
      return value.toLowerCase().replace(/[^\p{L}]/gu, "");
    case "ct":
    case "st":
      return value.toLowerCase().replace(/[^\p{L}]/gu, "");
    case "zp":
      return value.toLowerCase().replace(/\s/g, "");
    case "country":
      return value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 2);
    case "external_id":
      return value;
    default:
      return value;
  }
}

/** Normalise, then hash. Empty in, empty out — never hash a blank string. */
export function hashMatchValue(field: MatchField, raw: string): string {
  const normalized = normalizeMatchValue(field, raw);
  return normalized ? sha256(normalized) : "";
}

export interface UserIdentity {
  phone?: string | null;
  email?: string | null;
  fullName?: string | null;
  city?: string | null;
  country?: string | null;
  externalId?: string | null;
}

/** Meta's user_data block. Keys with no value are omitted, never sent empty. */
export function buildUserData(identity: UserIdentity): Record<string, string[] | string> {
  const out: Record<string, string[] | string> = {};
  const add = (key: string, field: MatchField, value: string | null | undefined) => {
    if (!value) return;
    const hashed = hashMatchValue(field, value);
    if (hashed) out[key] = [hashed];
  };

  add("ph", "ph", identity.phone);
  add("em", "em", identity.email);
  add("ct", "ct", identity.city);
  add("country", "country", identity.country ?? "PK");

  if (identity.fullName) {
    const parts = identity.fullName.trim().split(/\s+/);
    add("fn", "fn", parts[0]);
    if (parts.length > 1) add("ln", "ln", parts[parts.length - 1]);
  }
  if (identity.externalId) {
    const hashed = hashMatchValue("external_id", identity.externalId);
    if (hashed) out.external_id = [hashed];
  }
  return out;
}
