import "server-only";
import { randomUUID } from "node:crypto";
import { claimJobs, completeJob, failJob, reclaimStuck } from "./queue";
import { handlerFor } from "./handlers";
import { PermanentJobError } from "./types";

/**
 * One pass of the worker.
 *
 * Called by the cron endpoint every minute. Claiming is atomic
 * (FOR UPDATE SKIP LOCKED), so two overlapping runs simply split the queue
 * between them rather than fighting over it.
 */

export interface RunSummary {
  claimed: number;
  succeeded: number;
  failed: number;
  dead: number;
  reclaimed: number;
  durationMs: number;
  results: Array<{ id: string; type: string; ok: boolean; error?: string }>;
}

/** Vercel's function budget is finite; stop claiming before it runs out. */
const BUDGET_MS = 45_000;

export async function runJobs(batchSize = 10): Promise<RunSummary> {
  const started = Date.now();
  const workerId = `w_${randomUUID().slice(0, 8)}`;
  const summary: RunSummary = {
    claimed: 0,
    succeeded: 0,
    failed: 0,
    dead: 0,
    reclaimed: 0,
    durationMs: 0,
    results: [],
  };

  summary.reclaimed = await reclaimStuck();
  const jobs = await claimJobs(batchSize, workerId);
  summary.claimed = jobs.length;

  for (const job of jobs) {
    if (Date.now() - started > BUDGET_MS) {
      // Hand the rest back rather than being killed mid-flight.
      await failJob(job, "Worker ran out of time; requeued.");
      summary.failed += 1;
      summary.results.push({ id: job.id, type: job.type, ok: false, error: "requeued" });
      continue;
    }

    const handler = handlerFor(job.type);
    if (!handler) {
      await failJob(job, `No handler is registered for job type "${job.type}".`, true);
      summary.dead += 1;
      summary.results.push({ id: job.id, type: job.type, ok: false, error: "no handler" });
      continue;
    }

    try {
      const result = await handler(job);
      await completeJob(job.id, result);
      summary.succeeded += 1;
      summary.results.push({ id: job.id, type: job.type, ok: true });
    } catch (err) {
      const permanent = err instanceof PermanentJobError;
      const message = err instanceof Error ? err.message : String(err);
      const outcome = await failJob(job, message, permanent);
      if (outcome.status === "dead") summary.dead += 1;
      else summary.failed += 1;
      summary.results.push({ id: job.id, type: job.type, ok: false, error: message });
    }
  }

  summary.durationMs = Date.now() - started;
  return summary;
}
