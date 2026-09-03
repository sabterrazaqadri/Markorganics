import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrations, jobs, shipments } from "@/lib/db/schema";
import { PROVIDER_SPECS, isProvider, type ProviderId } from "./registry";

/**
 * What the dashboard shows when something is wrong.
 *
 * "Failing" means the last call errored and no successful call has happened
 * since — not that a call has ever failed. A provider that failed once at
 * 3am and has worked ever since is healthy, and saying otherwise trains
 * people to ignore the strip.
 */

export interface HealthRow {
  provider: ProviderId;
  name: string;
  message: string;
  since: Date;
}

export interface HealthSummary {
  failing: HealthRow[];
  deadJobs: number;
  /** Booked shipments nothing has heard about in over a day. */
  staleShipments: number;
  dryRun: boolean;
}

export async function integrationHealth(): Promise<HealthSummary> {
  const { getIntegrationSettings } = await import("@/lib/settings");

  const [rows, [deadJobs], [stale], settings] = await Promise.all([
    db.select().from(integrations).where(eq(integrations.isEnabled, true)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(jobs)
      .where(eq(jobs.status, "dead")),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(shipments)
      .where(
        and(
          sql`${shipments.status} NOT IN ('delivered', 'returned', 'cancelled', 'expired')`,
          sql`coalesce(${shipments.lastSyncAt}, ${shipments.bookedAt}) < now() - interval '24 hours'`,
        ),
      ),
    getIntegrationSettings(),
  ]);

  const failing: HealthRow[] = [];
  for (const row of rows) {
    if (!row.lastErrorAt || !isProvider(row.provider)) continue;
    if (row.lastSuccessAt && row.lastSuccessAt > row.lastErrorAt) continue;
    failing.push({
      provider: row.provider,
      name: PROVIDER_SPECS[row.provider].name,
      message: row.lastErrorMessage ?? "Unknown error",
      since: row.lastErrorAt,
    });
  }

  return {
    failing,
    deadJobs: deadJobs?.n ?? 0,
    staleShipments: stale?.n ?? 0,
    dryRun: settings.dryRun,
  };
}

/** Cheap enough for the panel layout's nav badge. */
export async function deadJobCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.status, "dead"), gt(jobs.attempts, 0)));
  return row?.n ?? 0;
}
