import "../scripts/env";
import { strict as assert } from "node:assert";
import test, { after, before } from "node:test";
import { and, eq, inArray, sql } from "drizzle-orm";

/**
 * End-to-end flows, entirely in dry-run.
 *
 * These talk to the real database (the one in .env.local) but to no external
 * service: every outbound call is answered by the adapter's own fake. The
 * suite refuses to run at all unless global dry-run is on, because a test that
 * can book a real parcel is not a test.
 *
 * Everything it creates is namespaced with a run id and deleted afterwards.
 */

const hasDb = Boolean(process.env.DATABASE_URL);
const RUN = `t${Date.now().toString(36)}`;
const TEST_CITY = `Testville ${RUN}`;
const TEST_PHONE = "+923009999999";
/** wa.me form, which is what whatsapp_messages stores. */
const TEST_NUMBERS = ["923009999999", "923008888888"];
const STARTED_AT = new Date();

let dryRunOn = false;
let orderId = "";
let shipmentId = "";
let templateId = "";
/** The whatsapp integration row as it was before the test touched it. */
let whatsappRowBefore: { isEnabled: boolean; dryRun: boolean } | null = null;
let whatsappRowExisted = false;
const createdJobIds: string[] = [];

async function db() {
  return (await import("@/lib/db")).db;
}
async function schema() {
  return import("@/lib/db/schema");
}

before(async () => {
  if (!hasDb) return;
  const { getIntegrationSettings } = await import("@/lib/settings");
  dryRunOn = (await getIntegrationSettings()).dryRun;
});

function guard(t: { skip: (reason?: string) => void }): boolean {
  if (!hasDb) {
    t.skip("DATABASE_URL is not set");
    return false;
  }
  if (!dryRunOn) {
    t.skip("Global dry-run is off. These tests refuse to run when a real booking is possible.");
    return false;
  }
  return true;
}

/* ------------------------------------------------------------ order setup */

test("an order and a city mapping can be prepared", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { courierCities, orderEvents, orderItems, orders } = await schema();

  const [order] = await d
    .insert(orders)
    .values({
      orderNumber: `TST-${RUN.toUpperCase()}`,
      status: "confirmed",
      customerName: "Integration Test",
      phone: TEST_PHONE,
      city: TEST_CITY,
      address: "1 Test Street",
      subtotalPaisa: 150_000,
      discountPaisa: 0,
      deliveryPaisa: 20_000,
      totalPaisa: 170_000,
      itemCount: 2,
    })
    .returning({ id: orders.id });
  orderId = order.id;

  await d.insert(orderItems).values({
    orderId,
    // Deliberately null: this test must not move real stock around.
    variantId: null,
    productSlug: "test-oil",
    productName: "Test Hair Oil",
    variantLabel: "100ml",
    sku: `TST-${RUN}`,
    unitPricePaisa: 75_000,
    quantity: 2,
    lineTotalPaisa: 150_000,
  });

  await d.insert(orderEvents).values({ orderId, type: "created", toStatus: "pending", message: "Test fixture" });

  await d.insert(courierCities).values({
    provider: "postex",
    markCity: TEST_CITY,
    courierCityId: "Karachi",
    courierCityName: "Karachi",
    confirmedAt: new Date(),
  });

  assert.ok(orderId);
});

/* --------------------------------------------------- book → sync → deliver */

test("booking stores a tracking number, ships the order and writes a timeline entry", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { orderEvents, orders, shipments } = await schema();
  const { bookShipment } = await import("@/lib/courier/shipments");

  const result = await bookShipment({ orderId, provider: "postex" , pickupAddressCode: "001" });
  shipmentId = result.shipmentId;

  assert.ok(result.trackingNumber.startsWith("DRY"), "dry-run bookings get an obviously fake tracking number");
  assert.equal(result.dryRun, true, "nothing may reach a courier from a test");

  const [shipment] = await d.select().from(shipments).where(eq(shipments.id, shipmentId));
  assert.equal(shipment.provider, "postex");
  assert.equal(shipment.status, "booked");
  assert.equal(shipment.courierCityId, "Karachi", "the mapped courier city was used, not the MARK city");
  assert.equal(shipment.codAmountPaisa, 170_000, "the courier collects the order total");

  const [order] = await d.select().from(orders).where(eq(orders.id, orderId));
  assert.equal(order.status, "shipped");

  const events = await d.select().from(orderEvents).where(eq(orderEvents.orderId, orderId));
  assert.ok(
    events.some((e) => e.message?.includes(result.trackingNumber)),
    "the tracking number belongs in the order timeline",
  );
});

test("booking the same order twice does not create a second parcel", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { shipments } = await schema();
  const { bookShipment } = await import("@/lib/courier/shipments");

  const again = await bookShipment({ orderId, provider: "postex", pickupAddressCode: "001" });
  assert.equal(again.shipmentId, shipmentId, "the existing shipment is returned, not a new one");

  const rows = await d.select().from(shipments).where(eq(shipments.orderId, orderId));
  assert.equal(rows.length, 1);
});

test("booking is refused when the city has no mapping", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { orders } = await schema();
  const { bookShipment } = await import("@/lib/courier/shipments");
  const { PermanentJobError } = await import("@/lib/jobs/types");

  const [unmapped] = await d
    .insert(orders)
    .values({
      orderNumber: `TST-${RUN.toUpperCase()}-U`,
      status: "confirmed",
      customerName: "Unmapped City",
      phone: TEST_PHONE,
      city: `Nowhere ${RUN}`,
      address: "2 Test Street",
      subtotalPaisa: 10_000,
      deliveryPaisa: 0,
      totalPaisa: 10_000,
      itemCount: 1,
    })
    .returning({ id: orders.id });

  await assert.rejects(
    () => bookShipment({ orderId: unmapped.id, provider: "postex", pickupAddressCode: "001" }),
    (err: Error) => err instanceof PermanentJobError && /not mapped/i.test(err.message),
    "an unmapped city must fail permanently, not retry five times",
  );

  await d.delete(orders).where(eq(orders.id, unmapped.id));
});

test("a status sync records the courier's history and moves the order", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { shipmentEvents, orders } = await schema();
  const { syncShipment } = await import("@/lib/courier/shipments");

  const result = await syncShipment(shipmentId, "manual");
  assert.equal(result.status, "out_for_delivery");
  assert.equal(result.changed, true);

  const events = await d.select().from(shipmentEvents).where(eq(shipmentEvents.shipmentId, shipmentId));
  const raws = events.map((e) => e.rawStatus);
  assert.ok(raws.includes("Picked By PostEx"), "each scan in the history becomes an event");
  assert.ok(raws.includes("Out For Delivery"));

  const [order] = await d.select().from(orders).where(eq(orders.id, orderId));
  assert.equal(order.status, "shipped", "out for delivery is still shipped");
});

test("syncing twice does not duplicate the courier's events", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { shipmentEvents } = await schema();
  const { syncShipment } = await import("@/lib/courier/shipments");

  const before = await d.select().from(shipmentEvents).where(eq(shipmentEvents.shipmentId, shipmentId));
  await syncShipment(shipmentId, "manual");
  const after = await d.select().from(shipmentEvents).where(eq(shipmentEvents.shipmentId, shipmentId));

  assert.equal(after.length, before.length, "the (shipment, status, time) key deduplicates repeated polls");
});

test("delivery closes the order and stamps the shipment", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { orders, shipments } = await schema();
  const { applyTrackingResult } = await import("@/lib/courier/shipments");

  const [shipment] = await d.select().from(shipments).where(eq(shipments.id, shipmentId));
  const outcome = await applyTrackingResult(
    shipment,
    {
      status: "delivered",
      rawStatus: "Delivered",
      events: [
        {
          status: "delivered",
          rawStatus: "Delivered",
          message: "Received by customer",
          location: "Karachi",
          occurredAt: new Date(),
        },
      ],
    },
    "poll",
  );

  assert.equal(outcome.status, "delivered");
  assert.equal(outcome.changed, true);

  const [order] = await d.select().from(orders).where(eq(orders.id, orderId));
  assert.equal(order.status, "delivered");

  const [updated] = await d.select().from(shipments).where(eq(shipments.id, shipmentId));
  assert.ok(updated.deliveredAt, "deliveredAt drives the COD reconciliation window");
});

test("delivery queues the customer's WhatsApp notification exactly once", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { jobs } = await schema();

  const rows = await d
    .select()
    .from(jobs)
    .where(and(eq(jobs.type, "whatsapp.send"), eq(jobs.idempotencyKey, `wa:order_delivered:${orderId}`)));

  assert.equal(rows.length, 1, "one job per order per trigger, however many times the sync runs");
  createdJobIds.push(...rows.map((r) => r.id));
});

test("an unpaid delivered parcel shows up in COD reconciliation", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { shipments } = await schema();
  const { outstandingCod } = await import("@/lib/courier/shipments");

  // Pretend it was delivered a fortnight ago and nothing was remitted.
  await d
    .update(shipments)
    .set({ deliveredAt: new Date(Date.now() - 14 * 24 * 3600_000) })
    .where(eq(shipments.id, shipmentId));

  const outstanding = await outstandingCod("postex", 7);
  const mine = outstanding.find((row) => row.id === shipmentId);

  assert.ok(mine, "a parcel delivered a fortnight ago with no payment must be impossible to miss");
  assert.equal(mine.shortfallPaisa, 170_000);
  assert.ok(mine.daysSinceDelivery >= 13);
});

/* ------------------------------------------------------------- job queue */

test("an idempotency key stops the same work being queued twice", async (t) => {
  if (!guard(t)) return;
  const { enqueue } = await import("@/lib/jobs/queue");
  const key = `test:dupe:${RUN}`;

  const first = await enqueue({ type: "test.noop", payload: { n: 1 }, idempotencyKey: key });
  const second = await enqueue({ type: "test.noop", payload: { n: 2 }, idempotencyKey: key });

  assert.ok(first, "the first enqueue wins");
  assert.equal(second, null, "the second is dropped rather than duplicating the work");
  createdJobIds.push(first!);
});

test("a failure schedules the next attempt on the ladder, and the last one buries the job", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { jobs } = await schema();
  const { enqueue, failJob } = await import("@/lib/jobs/queue");

  const id = await enqueue({ type: "test.retry", idempotencyKey: `test:retry:${RUN}`, maxAttempts: 2 });
  assert.ok(id);
  createdJobIds.push(id!);

  const [queued] = await d.select().from(jobs).where(eq(jobs.id, id!));
  const firstFailure = await failJob({ ...queued, attempts: 1 }, "Courier timed out");

  assert.equal(firstFailure.status, "queued", "attempt 1 of 2 retries");
  const waitMs = firstFailure.runAfter!.getTime() - Date.now();
  assert.ok(waitMs > 45_000 && waitMs < 75_000, `first retry should be about a minute away, was ${waitMs}ms`);

  const [retrying] = await d.select().from(jobs).where(eq(jobs.id, id!));
  assert.equal(retrying.lastError, "Courier timed out");

  const exhausted = await failJob({ ...queued, attempts: 2 }, "Courier timed out again");
  assert.equal(exhausted.status, "dead", "out of attempts means a human has to look");

  const [dead] = await d.select().from(jobs).where(eq(jobs.id, id!));
  assert.equal(dead.status, "dead");
  assert.ok(dead.finishedAt);
});

test("a permanent failure skips the retry ladder entirely", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { jobs } = await schema();
  const { enqueue, failJob } = await import("@/lib/jobs/queue");

  const id = await enqueue({ type: "test.permanent", idempotencyKey: `test:perm:${RUN}` });
  createdJobIds.push(id!);

  const [row] = await d.select().from(jobs).where(eq(jobs.id, id!));
  const outcome = await failJob({ ...row, attempts: 1 }, "City is not mapped", true);

  assert.equal(outcome.status, "dead", "retrying an unmapped city four more times helps nobody");
  assert.equal(outcome.runAfter, null);
});

test("enqueueing never throws, however broken the payload", async (t) => {
  if (!guard(t)) return;
  const { enqueue } = await import("@/lib/jobs/queue");

  // A BigInt cannot be serialised to JSON: the insert fails inside the queue.
  const result = await enqueue({
    type: "test.unserialisable",
    payload: { bad: BigInt(1) as unknown as number },
    idempotencyKey: `test:bad:${RUN}`,
  });

  assert.equal(result, null, "a broken enqueue returns null so an order can still succeed");
});

/* -------------------------------------------------------------- WhatsApp */

test("a template send is logged in full and leaves the building nowhere", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { whatsappMessages, whatsappTemplates } = await schema();
  const { sendTemplate, renderTemplate } = await import("@/lib/whatsapp/client");
  const { saveIntegration } = await import("@/lib/integrations/config");

  // The WhatsApp adapter refuses when the provider is switched off, so switch
  // it on and leave dry-run on to keep the message inside the building. The
  // previous state is captured so the cleanup can put it back: a test must not
  // leave an integration switched on behind it.
  const { integrations } = await schema();
  const [existing] = await d.select().from(integrations).where(eq(integrations.provider, "whatsapp")).limit(1);
  whatsappRowExisted = Boolean(existing);
  whatsappRowBefore = existing ? { isEnabled: existing.isEnabled, dryRun: existing.dryRun } : null;

  await saveIntegration({ provider: "whatsapp", isEnabled: true, dryRun: true, config: { phoneNumberId: "test" } });

  const [template] = await d
    .insert(whatsappTemplates)
    .values({
      name: `mark_test_${RUN}`,
      language: "en",
      category: "utility",
      body: "Hello {{1}}, your order {{2}} is on the way. Track it: {{3}}",
      variables: ["customer_name", "order_number", "tracking_url"],
      approvalStatus: "local",
      isEnabled: true,
    })
    .returning({ id: whatsappTemplates.id });
  templateId = template.id;

  const result = await sendTemplate(
    TEST_PHONE,
    `mark_test_${RUN}`,
    ["Ayesha", "TST-1", "https://example.com/track/DRY1"],
    { orderId, trigger: "order_shipped" },
  );

  assert.equal(result.ok, true, result.message);
  assert.equal(result.dryRun, true);
  assert.ok(result.wamid?.includes("DRY"), "the dry-run message id is obviously fake");

  const [logged] = await d
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.wamid, result.wamid!))
    .limit(1);

  assert.ok(logged, "every send is recorded, dry-run included");
  assert.equal(logged.category, "utility", "the billing category is what makes the monthly cost legible");
  assert.equal(logged.dryRun, true);
  assert.equal(logged.orderId, orderId);
  assert.equal(
    logged.body,
    renderTemplate(
      { ...template, body: "Hello {{1}}, your order {{2}} is on the way. Track it: {{3}}" } as never,
      ["Ayesha", "TST-1", "https://example.com/track/DRY1"],
    ),
  );
});

test("free-form text outside the 24-hour window is skipped, not attempted", async (t) => {
  if (!guard(t)) return;
  const { sendText } = await import("@/lib/whatsapp/client");

  // No inbound message from this number, so the service window is shut.
  const result = await sendText("+923008888888", "Just checking in", { trigger: "manual" });

  assert.equal(result.ok, false);
  assert.equal(result.outcome, "skipped", "a closed window is a decision, not a failure to retry");
  assert.match(result.message, /24-hour/);
});

test("an abandoned checkout schedules a follow-up that the order then cancels", async (t) => {
  if (!guard(t)) return;
  const d = await db();
  const { abandonedCheckouts, jobs } = await schema();
  const { captureCheckout, markRecovered } = await import("@/lib/admin/abandoned");
  const { cancelQueued, enqueue } = await import("@/lib/jobs/queue");
  const { fireAbandonedFollowUp } = await import("@/lib/whatsapp/triggers");

  const sessionKey = `sess-${RUN}`;
  const abandonedId = await captureCheckout({
    sessionKey,
    name: "Ayesha Khan",
    phone: TEST_PHONE,
    city: TEST_CITY,
    address: "3 Test Street",
    cart: [
      { variantId: "00000000-0000-0000-0000-000000000000", productName: "Test Hair Oil", variantLabel: "100ml", sku: `TST-${RUN}`, unitPricePaisa: 75_000, quantity: 2 },
    ],
  });
  assert.ok(abandonedId);

  const key = `wa:abandoned:${sessionKey}`;
  const jobId = await enqueue({
    type: "whatsapp.abandoned",
    payload: { abandonedId, sessionKey },
    idempotencyKey: key,
    runAfter: new Date(Date.now() + 4 * 3600_000),
  });
  assert.ok(jobId, "the follow-up is queued for later, not sent now");
  createdJobIds.push(jobId!);

  const [queued] = await d.select().from(jobs).where(eq(jobs.id, jobId!));
  assert.ok(queued.runAfter.getTime() > Date.now() + 3 * 3600_000, "it waits the configured number of hours");

  // The customer finishes the order: the chase must stop.
  await markRecovered(d, sessionKey, orderId, TEST_PHONE);
  const cancelled = await cancelQueued(key);
  assert.equal(cancelled, 1, "placing the order deletes the pending follow-up");

  // And belt-and-braces: even if the job somehow ran, the handler checks again.
  const outcome = await fireAbandonedFollowUp(abandonedId!);
  assert.equal(outcome.outcome, "skipped");
  assert.match(outcome.message, /recovered|switched off/);

  await d.delete(abandonedCheckouts).where(eq(abandonedCheckouts.id, abandonedId!));
});

/* --------------------------------------------------------------- cleanup */

after(async () => {
  if (!hasDb || !dryRunOn) return;
  const d = await db();
  const { courierCities, integrationEvents, jobs, orders, whatsappMessages, whatsappTemplates } = await schema();

  try {
    // Skipped sends carry no order id, so clear by the test number as well.
    await d.delete(whatsappMessages).where(inArray(whatsappMessages.phone, TEST_NUMBERS));
    if (orderId) {
      await d.delete(whatsappMessages).where(eq(whatsappMessages.orderId, orderId));
      // order_items, order_events and shipments all cascade from the order.
      await d.delete(orders).where(eq(orders.id, orderId));
    }
    if (templateId) await d.delete(whatsappTemplates).where(eq(whatsappTemplates.id, templateId));

    const { integrations } = await schema();
    if (whatsappRowExisted && whatsappRowBefore) {
      await d
        .update(integrations)
        .set({ isEnabled: whatsappRowBefore.isEnabled, dryRun: whatsappRowBefore.dryRun })
        .where(eq(integrations.provider, "whatsapp"));
    } else if (!whatsappRowExisted) {
      await d.delete(integrations).where(eq(integrations.provider, "whatsapp"));
    }
    await d.delete(courierCities).where(and(eq(courierCities.provider, "postex"), eq(courierCities.markCity, TEST_CITY)));
    if (createdJobIds.length) await d.delete(jobs).where(inArray(jobs.id, createdJobIds));

    /* Booking and syncing queue jobs of their own — a notification per status
       change, a follow-up poll per shipment. Those reference an order that no
       longer exists, so they would sit in the dead pile confusing whoever
       looks at the jobs page next. */
    for (const id of [orderId, shipmentId].filter(Boolean)) {
      await d.delete(jobs).where(sql`${jobs.idempotencyKey} LIKE ${`%${id}%`}`);
    }
    await d.delete(jobs).where(eq(jobs.type, "test.noop"));
    // The dry-run calls this run logged: real entries, but not the shop's.
    await d.delete(integrationEvents).where(sql`${integrationEvents.createdAt} >= ${STARTED_AT.toISOString()}`);
  } catch (err) {
    console.error("test cleanup failed", err);
  }

  // The Neon pool holds the process open otherwise.
  const pool = (globalThis as { __mrkPool?: { end: () => Promise<void> } }).__mrkPool;
  await pool?.end();
});
