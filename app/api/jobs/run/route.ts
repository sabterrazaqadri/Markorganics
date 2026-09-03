import { NextResponse } from "next/server";
import { authorizeRunner } from "@/lib/jobs/auth";
import { runJobs } from "@/lib/jobs/run";

/**
 * The worker. Triggered by a Vercel cron every minute (see vercel.json), and
 * callable by hand with:
 *
 *   curl -H "x-jobs-secret: $JOBS_RUNNER_SECRET" https://<host>/api/jobs/run
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request): Promise<NextResponse> {
  const auth = authorizeRunner(request.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 });

  const url = new URL(request.url);
  const batch = Math.min(50, Math.max(1, Number(url.searchParams.get("batch") ?? 10) || 10));

  try {
    const summary = await runJobs(batch);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("job runner failed", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
