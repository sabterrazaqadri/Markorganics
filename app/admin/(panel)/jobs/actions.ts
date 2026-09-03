"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";
import { ActionError, run, type ActionResult } from "@/lib/admin/result";
import { killJob, retryJob } from "@/lib/jobs/queue";
import { runJobs } from "@/lib/jobs/run";

export async function retryJobAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("jobs:write");
    if (!(await retryJob(id))) throw new ActionError("That job is already running or has finished.");
    await audit(ctx, { action: "job.retry", entityType: "job", entityId: id });
    revalidatePath("/admin/jobs");
    return null;
  });
}

export async function killJobAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("jobs:write");
    if (!(await killJob(id))) throw new ActionError("That job has already finished.");
    await audit(ctx, { action: "job.kill", entityType: "job", entityId: id });
    revalidatePath("/admin/jobs");
    return null;
  });
}

/**
 * Runs a batch by hand.
 *
 * The cron does this every minute in production; this button exists so the
 * queue can be watched working during setup, before any cron is configured.
 */
export async function runJobsNowAction(): Promise<ActionResult<{ claimed: number; succeeded: number; failed: number; dead: number }>> {
  return run(async () => {
    const ctx = await requirePermission("jobs:write");
    const summary = await runJobs(10);
    await audit(ctx, {
      action: "job.run_now",
      entityType: "job",
      after: { claimed: summary.claimed, succeeded: summary.succeeded, failed: summary.failed, dead: summary.dead },
    });
    revalidatePath("/admin/jobs");
    revalidatePath("/admin");
    return {
      claimed: summary.claimed,
      succeeded: summary.succeeded,
      failed: summary.failed,
      dead: summary.dead,
    };
  });
}
