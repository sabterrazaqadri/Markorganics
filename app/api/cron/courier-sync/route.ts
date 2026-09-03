import { NextResponse } from "next/server";
import { authorizeRunner } from "@/lib/jobs/auth";
import { enqueue } from "@/lib/jobs/queue";
import { JOB } from "@/lib/jobs/types";

/**
 * Every 30 minutes: queue one fan-out job that in turn queues a sync per
 * in-transit shipment.
 *
 * The cron does not poll couriers itself — it only enqueues — so a courier
 * that hangs cannot take the cron slot down with it. Where a courier offers
 * webhooks, those arrive at /api/webhooks/courier/[provider] and this polling
 * only ever confirms what the webhook already said.
 */

export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<NextResponse> {
  const auth = authorizeRunner(request.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const id = await enqueue({
    type: JOB.courierSyncAll,
    // One fan-out per half-hour window, however many times the cron fires.
    idempotencyKey: `sync_all:${Math.floor(Date.now() / (30 * 60_000))}`,
  });

  return NextResponse.json({ queued: Boolean(id), jobId: id });
}

export const GET = handle;
export const POST = handle;
