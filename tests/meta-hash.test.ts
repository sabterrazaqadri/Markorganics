import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  buildUserData,
  hashMatchValue,
  normalizeMatchValue,
  normalizePhoneForMeta,
} from "@/lib/analytics/hash";

/**
 * The hashing tests.
 *
 * This is the part that is usually wrong, and wrong silently: Meta accepts a
 * badly normalised hash and simply never matches it to a person, so nothing
 * looks broken while attribution quietly reads zero. Hence exact expectations
 * rather than "it returns 64 hex characters".
 */

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

test("phone numbers are normalised to country code plus digits", () => {
  // A Pakistani local number is meaningless to Meta without the 92.
  assert.equal(normalizePhoneForMeta("0300 1234567"), "923001234567");
  assert.equal(normalizePhoneForMeta("+92 300 1234567"), "923001234567");
  assert.equal(normalizePhoneForMeta("+92-300-1234567"), "923001234567");
  assert.equal(normalizePhoneForMeta("0092 300 1234567"), "923001234567");
  assert.equal(normalizePhoneForMeta("923001234567"), "923001234567");
  assert.equal(normalizePhoneForMeta("(0300) 123 4567"), "923001234567");
  assert.equal(normalizePhoneForMeta(""), "");
});

test("every phone spelling produces one identical hash", () => {
  const expected = sha("923001234567");
  for (const spelling of ["0300 1234567", "+923001234567", "0092-300-1234567", "  +92 300 1234567  "]) {
    assert.equal(hashMatchValue("ph", spelling), expected, `spelling: ${spelling}`);
  }
});

test("emails are trimmed and lowercased, nothing else", () => {
  assert.equal(normalizeMatchValue("em", "  Sabter.Iqbal+shop@Example.COM "), "sabter.iqbal+shop@example.com");
  assert.equal(hashMatchValue("em", "SABTER@EXAMPLE.COM"), sha("sabter@example.com"));
});

test("names keep letters only", () => {
  assert.equal(normalizeMatchValue("fn", "  Sabter "), "sabter");
  assert.equal(normalizeMatchValue("ln", "O'Brien-Smith Jr."), "obriensmithjr");
  assert.equal(normalizeMatchValue("fn", "Ali 2nd"), "alind");
});

test("city and state drop spaces and punctuation", () => {
  assert.equal(normalizeMatchValue("ct", "Rahim Yar Khan"), "rahimyarkhan");
  assert.equal(normalizeMatchValue("ct", "Wah Cantonment"), "wahcantonment");
  assert.equal(normalizeMatchValue("st", "Khyber Pakhtunkhwa"), "khyberpakhtunkhwa");
});

test("country is a two-letter lowercase code", () => {
  assert.equal(normalizeMatchValue("country", "PK"), "pk");
  assert.equal(normalizeMatchValue("country", "Pakistan"), "pa");
});

test("zip loses whitespace but keeps everything else", () => {
  assert.equal(normalizeMatchValue("zp", " 75500 "), "75500");
  assert.equal(normalizeMatchValue("zp", "SW1A 1AA"), "sw1a1aa");
});

test("external ids are hashed as given, not lowercased", () => {
  const id = "Cust-ABC-123";
  assert.equal(normalizeMatchValue("external_id", id), id);
  assert.equal(hashMatchValue("external_id", id), sha(id));
});

test("an empty value hashes to an empty string, never to the hash of nothing", () => {
  // sha256("") is a real, valid-looking hash. Sending it would match nobody
  // while looking exactly like a working field.
  for (const field of ["em", "ph", "fn", "ln", "ct", "zp", "country"] as const) {
    assert.equal(hashMatchValue(field, ""), "");
    assert.equal(hashMatchValue(field, "   "), "");
  }
});

test("user_data omits absent fields and wraps present ones in arrays", () => {
  const data = buildUserData({
    phone: "0300 1234567",
    fullName: "Sabter Iqbal",
    city: "Karachi",
    email: null,
    externalId: "cust-1",
  });

  assert.deepEqual(data.ph, [sha("923001234567")]);
  assert.deepEqual(data.fn, [sha("sabter")]);
  assert.deepEqual(data.ln, [sha("iqbal")]);
  assert.deepEqual(data.ct, [sha("karachi")]);
  assert.deepEqual(data.country, [sha("pk")], "country defaults to PK");
  assert.deepEqual(data.external_id, [sha("cust-1")]);
  assert.equal("em" in data, false, "an absent email must not appear at all");
});

test("a single-word name produces a first name and no last name", () => {
  const data = buildUserData({ fullName: "Ayesha" });
  assert.deepEqual(data.fn, [sha("ayesha")]);
  assert.equal("ln" in data, false);
});

test("a three-word name uses the first and last parts", () => {
  const data = buildUserData({ fullName: "Muhammad Ali Khan" });
  assert.deepEqual(data.fn, [sha("muhammad")]);
  assert.deepEqual(data.ln, [sha("khan")]);
});
