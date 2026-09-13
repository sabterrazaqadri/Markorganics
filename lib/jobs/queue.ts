import "server-only";
import { after } from "next/server";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db, type Db } from "@/lib/db";
import { jobs, type Job, type JobStatus } from "@/lib/db/schema";

type Tx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * The durable queue every integration hangs off.
 *
 * Two rules make it safe to call from anywhere: enqueueing never throws (a
 * dead queue must not fail an order), and every job carries an idempotency
 * key so a retry cannot book the same shipment or send the same WhatsApp
 * message twice.
 */

/** 1m, 5m, 15m, 1h, 6h — then the job is dead and waits for a human. */
export const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

/** A worker that dies mid-job leaves a `running` row; reclaim it after this. */
export const STUCK_AFTER_MS = 10 * 60_000;

/** Deterministic +/-15% spread so a burst of failures does not retry in lockstep. */
export function backoffFor(attempts: number, random = Math.random()): number {
  const base = BACKOFF_MS[Math.min(Math.max(attempts, 1) - 1, BACKOFF_MS.length - 1)];
  const jitter = 0.85 + random * 0.3;
  return Math.round(base * jitter);
}

export interface EnqueueInput {
  type: string;
  payload?: Record<string, unknown>;
  /** Unique per logical action. A second enqueue with the same key is dropped. */
  idempotencyKey?: string;
  runAfter?: Date;
  maxAttempts?: number;
}

/**
 * Adds a job. Returns the id, or null when the key already exists or the
 * insert failed — callers treat both as "nothing more to do here".
 */
export async function enqueue(input: EnqueueInput, tx: Tx = db): Promise<string | null> {
  try {
    const rows = await tx
      .insert(jobs)
      .values({
        type: input.type,
        payload: (input.payload ?? {}) as never,
        idempotencyKey: input.idempotencyKey ?? null,
        runAfter: input.runAfter ?? new Date(),
        maxAttempts: input.maxAttempts ?? BACKOFF_MS.length,
      })
      .onConflictDoNothing({ target: jobs.idempotencyKey })
      .returning({ id: jobs.id });
    const id = rows[0]?.id ?? null;
    if (id && !(input.runAfter && input.runAfter.getTime() > Date.now())) kickRunner();
    return id;
  } catch (err) {
    console.error(`enqueue(${input.type}) failed`, err);
    return null;
  }
}

/**
 * Runs the worker once the current response has been sent, so a job queued
 * by a checkout or an admin action goes out within seconds instead of
 * waiting for the cron. The cron still exists for retries and delayed jobs;
 * on Vercel's Hobby plan it can only fire daily, which is why this matters.
 *
 * Outside a request scope (scripts, tests) `after` throws — that is fine,
 * the cron picks the job up.
 */
function kickRunner(): void {
  try {
    after(async () => {
      const { runJobs } = await import("./run");
      await runJobs(5).catch((err) => console.error("post-enqueue run failed", err));
    });
  } catch {
    // no request scope
  }
}

/**
 * Drops queued jobs matching a key. Used when a customer finishes the order
 * the abandoned-cart follow-up was about to chase them for.
 */
export async function cancelQueued(idempotencyKey: string, tx: Tx = db): Promise<number> {
  try {
    const rows = await tx
      .delete(jobs)
      .where(and(eq(jobs.idempotencyKey, idempotencyKey), eq(jobs.status, "queued")))
      .returning({ id: jobs.id });
    return rows.length;
  } catch (err) {
    console.error("cancelQueued failed", err);
    return 0;
  }
}

export async function cancelQueuedByType(type: string, keyPrefix: string): Promise<number> {
  const rows = await db
    .delete(jobs)
    .where(
      and(eq(jobs.type, type), eq(jobs.status, "queued"), sql`${jobs.idempotencyKey} LIKE ${`${keyPrefix}%`}`),
    )
    .returning({ id: jobs.id });
  return rows.length;
}

/**
 * Claims up to `limit` due jobs atomically.
 *
 * FOR UPDATE SKIP LOCKED inside the sub-select is what lets two cron runs
 * overlap without ever handing the same job to both.
 */
export async function claimJobs(limit: number, workerId: string): Promise<Job[]> {
  const result = await db.execute(sql`
    UPDATE jobs SET
      status = 'running',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = ${workerId},
      started_at = now(),
      updated_at = now()
    WHERE id IN (
      SELECT id FROM jobs
      WHERE status = 'queued' AND run_after <= now()
      ORDER BY run_after ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  return (result.rows as unknown as Job[]) ?? [];
}

/** Returns jobs whose worker died back to the queue. */
export async function reclaimStuck(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE jobs SET status = 'queued', locked_at = NULL, locked_by = NULL, updated_at = now()
    WHERE status = 'running' AND locked_at < now() - ${`${Math.round(STUCK_AFTER_MS / 1000)} seconds`}::interval
    RETURNING id
  `);
  return result.rows?.length ?? 0;
}

export async function completeJob(id: string, result: unknown): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: "succeeded",
      result: (result ?? null) as never,
      lastError: null,
      lockedAt: null,
      lockedBy: null,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));
}

export interface FailOutcome {
  status: JobStatus;
  runAfter: Date | null;
}

/**
 * Records a failure and schedules the retry, or buries the job once it has
 * used its attempts. `permanent` skips straight to dead for errors that will
 * never succeed however many times they are tried.
 */
export async function failJob(job: Job, error: string, permanent = false): Promise<FailOutcome> {
  const exhausted = permanent || job.attempts >= job.maxAttempts;
  const runAfter = exhausted ? null : new Date(Date.now() + backoffFor(job.attempts));

  await db
    .update(jobs)
    .set({
      status: exhausted ? "dead" : "queued",
      lastError: error.slice(0, 2000),
      runAfter: runAfter ?? job.runAfter,
      lockedAt: null,
      lockedBy: null,
      finishedAt: exhausted ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, job.id));

  return { status: exhausted ? "dead" : "queued", runAfter };
}

/* ---------------------------------------------------------------- admin */

export const JOBS_PAGE_SIZE = 50;

export interface JobFilter {
  type?: string;
  status?: JobStatus;
  page?: number;
}

export async function listJobs(filter: JobFilter): Promise<{ rows: Job[]; total: number; page: number }> {
  const conds: SQL[] = [];
  if (filter.type) conds.push(eq(jobs.type, filter.type));
  if (filter.status) conds.push(eq(jobs.status, filter.status));
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, filter.page ?? 1);

  const [rows, [{ n }]] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(where)
      .orderBy(desc(jobs.createdAt))
      .limit(JOBS_PAGE_SIZE)
      .offset((page - 1) * JOBS_PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(where),
  ]);
  return { rows, total: n, page };
}

export async function jobCounts(): Promise<Record<JobStatus, number>> {
  const rows = await db
    .select({ status: jobs.status, n: sql<number>`count(*)::int` })
    .from(jobs)
    .groupBy(jobs.status);
  const out = { queued: 0, running: 0, succeeded: 0, failed: 0, dead: 0 } as Record<JobStatus, number>;
  for (const row of rows) out[row.status] = row.n;
  return out;
}

export async function jobTypes(): Promise<string[]> {
  const rows = await db.selectDistinct({ type: jobs.type }).from(jobs).orderBy(jobs.type);
  return rows.map((r) => r.type);
}

/** Puts a dead or failed job back at the front of the queue. */
export async function retryJob(id: string): Promise<boolean> {
  const rows = await db
    .update(jobs)
    .set({ status: "queued", runAfter: new Date(), lockedAt: null, lockedBy: null, updatedAt: new Date() })
    .where(and(eq(jobs.id, id), inArray(jobs.status, ["dead", "failed", "queued"])))
    .returning({ id: jobs.id });
  return rows.length > 0;
}

export async function killJob(id: string): Promise<boolean> {
  const rows = await db
    .update(jobs)
    .set({ status: "dead", lastError: "Killed by an operator", finishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(jobs.id, id), inArray(jobs.status, ["queued", "running", "failed"])))
    .returning({ id: jobs.id });
  return rows.length > 0;
}

export async function getJob(id: string): Promise<Job | undefined> {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return row;
}
