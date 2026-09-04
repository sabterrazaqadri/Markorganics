import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Shared guard for the machine-to-machine endpoints.
 *
 * These routes are outside the admin middleware's matcher on purpose — a cron
 * has no session — so each one carries its own secret. An unset secret is a
 * closed door, not an open one: better a cron that never runs than an
 * endpoint anyone can trigger.
 */

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export interface AuthOutcome {
  ok: boolean;
  reason?: string;
}

/**
 * Accepts either `x-jobs-secret: <JOBS_RUNNER_SECRET>` (what a manual curl or
 * the admin "Run now" button sends) or `Authorization: Bearer <CRON_SECRET>`
 * (what Vercel Cron sends).
 */
export function authorizeRunner(headers: Headers): AuthOutcome {
  const jobsSecret = process.env.JOBS_RUNNER_SECRET ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";

  if (!jobsSecret && !cronSecret) {
    return { ok: false, reason: "Neither JOBS_RUNNER_SECRET nor CRON_SECRET is set, so this endpoint stays closed." };
  }

  const provided = headers.get("x-jobs-secret");
  if (provided && jobsSecret && safeEqual(provided, jobsSecret)) return { ok: true };

  const bearer = headers.get("authorization");
  if (bearer?.startsWith("Bearer ") && cronSecret && safeEqual(bearer.slice(7), cronSecret)) return { ok: true };

  return { ok: false, reason: "Bad or missing runner secret." };
}
