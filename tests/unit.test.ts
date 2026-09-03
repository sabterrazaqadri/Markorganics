import { strict as assert } from "node:assert";
import test from "node:test";
import { BACKOFF_MS, backoffFor } from "@/lib/jobs/queue";
import { decryptSecret, encryptSecret, encryptionAvailable, maskOf, resetKeyCache } from "@/lib/integrations/crypto";
import { redactBody, redactHeaders } from "@/lib/integrations/http";
import { normalizeCityName, similarity, suggestCity } from "@/lib/courier/cities";
import {
  POSTEX_STATUS_VOCABULARY,
  isTerminal,
  mapPostExStatus,
  orderStatusFor,
  SHIPMENT_STATUSES,
} from "@/lib/courier/status";
import { eventIdFor } from "@/lib/analytics/event-id";
import { parseRemittanceLines } from "@/lib/courier/cod";

/* --------------------------------------------------------------- backoff */

test("the retry ladder is 1m, 5m, 15m, 1h, 6h", () => {
  assert.deepEqual(BACKOFF_MS, [60_000, 300_000, 900_000, 3_600_000, 21_600_000]);
});

test("backoff grows with each attempt and stays inside its jitter band", () => {
  for (const [index, base] of BACKOFF_MS.entries()) {
    const attempt = index + 1;
    // random = 0 is the bottom of the band, 1 the top: 0.85x to 1.15x.
    assert.equal(backoffFor(attempt, 0), Math.round(base * 0.85));
    assert.equal(backoffFor(attempt, 1), Math.round(base * 1.15));
    assert.equal(backoffFor(attempt, 0.5), base);
  }
});

test("backoff past the end of the ladder stays at six hours", () => {
  assert.equal(backoffFor(99, 0.5), BACKOFF_MS[BACKOFF_MS.length - 1]);
});

test("jitter actually spreads retries apart", () => {
  const delays = new Set(Array.from({ length: 50 }, () => backoffFor(1)));
  assert.ok(delays.size > 10, "50 draws should not collapse onto a handful of values");
  for (const delay of delays) {
    assert.ok(delay >= 51_000 && delay <= 69_000, `${delay} is outside the first rung's band`);
  }
});

/* ------------------------------------------------------------- encryption */

test("a secret survives a round trip and reveals only its last four characters", () => {
  process.env.ENCRYPTION_MASTER_KEY = "a".repeat(64);
  resetKeyCache();

  assert.equal(encryptionAvailable(), true);
  const secret = "postex_live_token_ABCD1234";
  const envelope = encryptSecret(secret);

  assert.notEqual(envelope.cipher, secret);
  assert.equal(envelope.cipher.includes(secret), false, "the plaintext must not appear in the envelope");
  assert.equal(decryptSecret(envelope), secret);
  assert.equal(envelope.last4, "1234");
  assert.equal(maskOf(envelope), "••••1234");
});

test("the same secret encrypts differently every time", () => {
  process.env.ENCRYPTION_MASTER_KEY = "a".repeat(64);
  resetKeyCache();
  const a = encryptSecret("same-value");
  const b = encryptSecret("same-value");
  assert.notEqual(a.cipher, b.cipher, "a fresh IV per encryption");
  assert.equal(decryptSecret(a), decryptSecret(b));
});

test("a tampered ciphertext decrypts to null rather than throwing", () => {
  process.env.ENCRYPTION_MASTER_KEY = "a".repeat(64);
  resetKeyCache();
  const envelope = encryptSecret("token-value");
  assert.equal(decryptSecret({ ...envelope, cipher: Buffer.from("nonsense").toString("base64") }), null);
});

test("a different master key cannot read an old envelope", () => {
  process.env.ENCRYPTION_MASTER_KEY = "a".repeat(64);
  resetKeyCache();
  const envelope = encryptSecret("token-value");

  process.env.ENCRYPTION_MASTER_KEY = "b".repeat(64);
  resetKeyCache();
  assert.equal(decryptSecret(envelope), null, "a rotated key returns null, it does not throw");
});

test("with no master key, encryption refuses and decryption is silent", () => {
  delete process.env.ENCRYPTION_MASTER_KEY;
  resetKeyCache();
  assert.equal(encryptionAvailable(), false);
  assert.throws(() => encryptSecret("anything"), /ENCRYPTION_MASTER_KEY/);
  assert.equal(decryptSecret({ cipher: "x", iv: "y", tag: "z" }), null);
});

/* -------------------------------------------------------------- redaction */

test("authorisation headers never reach the log", () => {
  const redacted = redactHeaders({
    token: "postex-secret-token",
    Authorization: "Bearer wa-secret-token",
    "X-Hub-Signature-256": "sha256=abcdef",
    Accept: "application/json",
  });
  assert.equal(redacted.token, "«redacted»");
  assert.equal(redacted.Authorization, "«redacted»");
  assert.equal(redacted["X-Hub-Signature-256"], "«redacted»");
  assert.equal(redacted.Accept, "application/json", "harmless headers stay readable");
});

test("secret-looking body keys are blanked", () => {
  const body = redactBody({
    customerName: "Ayesha",
    access_token: "should-not-appear",
    nested: { apiKey: "also-not", password: "nor-this", city: "Karachi" },
  }) as Record<string, unknown>;

  assert.equal(body.customerName, "Ayesha");
  assert.equal(body.access_token, "«redacted»");
  const nested = body.nested as Record<string, unknown>;
  assert.equal(nested.apiKey, "«redacted»");
  assert.equal(nested.password, "«redacted»");
  assert.equal(nested.city, "Karachi");
});

test("a known secret is scrubbed even from an innocently named field", () => {
  const secret = "sk_live_9f2b7c1d";
  const body = redactBody({ url: `https://api.example.com/x?t=${secret}` }, [secret]) as Record<string, string>;
  assert.equal(body.url.includes(secret), false);
  assert.ok(body.url.includes("«redacted»"));
});

test("redaction does not choke on arrays, nulls or deep nesting", () => {
  const deep = { a: { b: { c: { d: { e: { f: { g: "too deep" } } } } } } };
  assert.doesNotThrow(() => redactBody(deep));
  assert.deepEqual(redactBody([1, "two", null]), [1, "two", null]);
  assert.equal(redactBody(null), null);
});

/* ----------------------------------------------------------- city mapping */

test("city names normalise past the noise words", () => {
  assert.equal(normalizeCityName("Wah Cantonment"), "wah");
  assert.equal(normalizeCityName("Mirpur (AJK)"), "mirpur");
  assert.equal(normalizeCityName("  RAHIM  YAR   KHAN "), "rahim yar khan");
});

test("similarity ranks a real match above a coincidence", () => {
  assert.equal(similarity("Karachi", "karachi"), 1);
  assert.ok(similarity("Karachi", "Karachi City") > 0.9);
  assert.ok(similarity("Rawalpindi", "Rawalpindi") > similarity("Rawalpindi", "Rahimyar Khan"));
  assert.ok(similarity("Lahore", "Karachi") < 0.5);
});

test("a suggestion is offered for a near match and withheld for a bad one", () => {
  const cities = [
    { id: "1", name: "Karachi" },
    { id: "2", name: "Lahore" },
    { id: "3", name: "Islamabad" },
  ];
  assert.equal(suggestCity("karachi ", cities)?.id, "1");
  assert.equal(suggestCity("Lahore City", cities)?.id, "2");
  // Nothing close enough: a wrong suggestion is worse than none, because a
  // person confirming a plausible-looking row is how parcels go astray.
  assert.equal(suggestCity("Gwadar", cities), null);
});

/* -------------------------------------------------------- status mapping */

test("every documented PostEx status maps to something real", () => {
  for (const raw of POSTEX_STATUS_VOCABULARY) {
    const mapped = mapPostExStatus(raw);
    assert.notEqual(mapped, "unknown", `"${raw}" fell through to unknown`);
    assert.ok(SHIPMENT_STATUSES.includes(mapped));
  }
});

test("status matching ignores case, spacing and punctuation", () => {
  assert.equal(mapPostExStatus("En-route to warehouse"), "in_transit");
  assert.equal(mapPostExStatus("enroute to Warehouse"), "in_transit");
  assert.equal(mapPostExStatus("EnRouteToWarehouse"), "in_transit");
  assert.equal(mapPostExStatus("Picked By PostEx"), "picked");
  assert.equal(mapPostExStatus("Delivery Under Review"), "under_review");
});

test("an unrecognised courier word becomes unknown rather than a wrong guess", () => {
  assert.equal(mapPostExStatus("Held At Customs"), "unknown");
  assert.equal(mapPostExStatus(""), "unknown");
});

test("shipment status maps to the order status a shopkeeper would expect", () => {
  assert.equal(orderStatusFor("delivered"), "delivered");
  assert.equal(orderStatusFor("returned"), "returned");
  assert.equal(orderStatusFor("expired"), "cancelled");
  assert.equal(orderStatusFor("out_for_delivery"), "shipped");
  // Out for return is still in the courier's hands: the parcel is not back yet.
  assert.equal(orderStatusFor("returning"), "shipped");
  assert.equal(orderStatusFor("unbooked"), null);
  assert.equal(orderStatusFor("unknown"), null);
});

test("only genuinely final states stop the poller", () => {
  assert.equal(isTerminal("delivered"), true);
  assert.equal(isTerminal("returned"), true);
  assert.equal(isTerminal("cancelled"), true);
  assert.equal(isTerminal("expired"), true);
  assert.equal(isTerminal("attempted"), false, "an attempted delivery will be tried again");
  assert.equal(isTerminal("returning"), false);
});

/* ------------------------------------------------------------- event ids */

test("an event id is stable for the same event and subject", () => {
  const a = eventIdFor("purchase", "order-123");
  const b = eventIdFor("purchase", "order-123");
  assert.equal(a, b, "the browser and the server must compute the same id");
  assert.notEqual(a, eventIdFor("purchase", "order-124"));
  assert.notEqual(a, eventIdFor("add_to_cart", "order-123"));
});

/* -------------------------------------------------------------- COD paste */

test("a courier remittance sheet parses whatever separator it arrives with", () => {
  const { lines, errors } = parseRemittanceLines("CN001, 1850\nCN002\t2400\nCN003;99.50\n\n");
  assert.equal(errors.length, 0);
  assert.deepEqual(lines, [
    { trackingNumber: "CN001", paidPaisa: 185_000 },
    { trackingNumber: "CN002", paidPaisa: 240_000 },
    { trackingNumber: "CN003", paidPaisa: 9_950 },
  ]);
});

test("a line with no readable amount is reported, not silently dropped", () => {
  const { lines, errors } = parseRemittanceLines("CN001, 1850\nCN002, paid later");
  assert.equal(lines.length, 1);
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes("Line 2"));
});

test("rupee formatting in a sheet does not break the parse", () => {
  const { lines } = parseRemittanceLines("CN001, Rs 1,850.00");
  assert.deepEqual(lines, [{ trackingNumber: "CN001", paidPaisa: 185_000 }]);
});
