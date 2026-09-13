import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { sendMetaEvent } from "@/lib/analytics/meta";
import { TRACKED_EVENTS } from "@/lib/analytics/events";

/**
 * Conversions API for the browser-only events.
 *
 * The pixel fires ViewContent, AddToCart, InitiateCheckout and Contact in the
 * browser, then posts the same event here with the same `event_id`, so a
 * visitor whose browser blocks the pixel (iOS, ad blockers) is still counted
 * and a visitor whose browser does not is not counted twice.
 *
 * Purchase is refused here on purpose. The job runner already sends it with
 * the customer's hashed phone and name from the order row, and Meta keeps
 * whichever copy of an event id arrives first — a thin browser-posted
 * Purchase would win over the rich one.
 *
 * Always answers 200. This route sits behind clicks on the shop; ad tracking
 * failing must never surface as a broken button.
 */

export const runtime = "nodejs";

const itemSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().max(200).default(""),
  quantity: z.number().int().min(1).max(999),
  pricePaisa: z.number().int().min(0).max(1_000_000_000),
});

const bodySchema = z.object({
  event: z.enum(TRACKED_EVENTS.filter((e) => e !== "purchase") as [string, ...string[]]),
  eventId: z.string().regex(/^evt_[a-z0-9_]{1,80}$/),
  valuePaisa: z.number().int().min(0).max(1_000_000_000).default(0),
  items: z.array(itemSchema).max(50).default([]),
  sourceUrl: z.string().url().max(2000).optional(),
});

const ok = (extra: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...extra });
const skipped = (reason: string) => NextResponse.json({ ok: false, reason }, { status: 200 });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;

  // A page view fans out to at most a handful of events; anything beyond
  // this from one address is a script, not a shopper.
  const rl = rateLimit(`meta-event:${ip ?? "unknown"}`, 120, 10 * 60 * 1000);
  if (!rl.ok) return skipped("rate_limited");

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return skipped("bad_json");
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return skipped("invalid");
  const input = parsed.data;

  // Only accept a source URL on this site; the pixel reports the page it was
  // on, and anything else would attribute a stranger's page to us.
  const origin = req.nextUrl.origin;
  const sourceUrl = input.sourceUrl && input.sourceUrl.startsWith(origin) ? input.sourceUrl : req.headers.get("referer") ?? undefined;

  try {
    const result = await sendMetaEvent({
      event: input.event as (typeof TRACKED_EVENTS)[number],
      eventId: input.eventId,
      valuePaisa: input.valuePaisa,
      currency: "PKR",
      items: input.items,
      sourceUrl,
      identity: {},
      clientIpAddress: ip,
      clientUserAgent: req.headers.get("user-agent"),
      fbp: req.cookies.get("_fbp")?.value ?? null,
      fbc: req.cookies.get("_fbc")?.value ?? null,
    });
    return result.ok ? ok({ dryRun: result.dryRun }) : skipped(result.message);
  } catch (err) {
    console.error("meta-event route failed", err);
    return skipped("error");
  }
}
