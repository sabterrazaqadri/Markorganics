import Link from "next/link";
import type { HealthSummary } from "@/lib/integrations/health";

/**
 * The one-line answer to "is anything broken right now".
 *
 * Renders nothing when everything is fine — a strip that is always there is a
 * strip nobody reads.
 */
export function HealthStrip({ health }: { health: HealthSummary }) {
  const problems = health.failing.length > 0 || health.deadJobs > 0 || health.staleShipments > 0;
  if (!problems && !health.dryRun) return null;

  return (
    <div className="mb-3 space-y-1.5">
      {health.failing.map((row) => (
        <p
          key={row.provider}
          role="alert"
          className="rounded border border-[#e8b4b0] bg-[var(--a-danger-bg)] px-2.5 py-2 text-[12px] text-[var(--a-danger)]"
        >
          <strong>{row.name} is failing.</strong> {row.message}{" "}
          <Link href="/admin/integrations/log" className="underline">
            See the call log
          </Link>
        </p>
      ))}

      {health.deadJobs > 0 ? (
        <p className="rounded border border-[#e8b4b0] bg-[var(--a-danger-bg)] px-2.5 py-2 text-[12px] text-[var(--a-danger)]">
          <strong>
            {health.deadJobs} job{health.deadJobs === 1 ? "" : "s"} gave up.
          </strong>{" "}
          They will not retry on their own.{" "}
          <Link href="/admin/jobs?status=dead" className="underline">
            Look at them
          </Link>
        </p>
      ) : null}

      {health.staleShipments > 0 ? (
        <p className="rounded border border-[#e6cfa0] bg-[var(--a-warn-bg)] px-2.5 py-2 text-[12px] text-[var(--a-warn)]">
          <strong>
            {health.staleShipments} shipment{health.staleShipments === 1 ? "" : "s"} have had no courier update in over
            a day.
          </strong>{" "}
          Either the courier is quiet or the sync is not running.
        </p>
      ) : null}

      {health.dryRun ? (
        <p className="rounded border border-[var(--a-border)] bg-[var(--a-info-bg)] px-2.5 py-2 text-[12px]">
          <strong>Dry run is on.</strong> Bookings, messages and ad events are simulated and logged, and nothing leaves
          the building.{" "}
          <Link href="/admin/integrations" className="underline">
            Integration settings
          </Link>
        </p>
      ) : null}
    </div>
  );
}
