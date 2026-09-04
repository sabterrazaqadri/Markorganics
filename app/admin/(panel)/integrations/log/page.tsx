import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrationEvents } from "@/lib/db/schema";
import { requireView } from "@/lib/admin/session";
import { PROVIDER_LIST, providerName } from "@/lib/integrations/registry";
import { EVENT_LOG_KEEP } from "@/lib/integrations/http";
import { Card, EmptyState } from "@/components/admin/ui";
import { AutoSubmit } from "@/components/admin/client-ui";
import { EventLogTable } from "@/components/admin/EventLogTable";

export const metadata = { title: "Integration call log" };
export const dynamic = "force-dynamic";

/**
 * Every outbound call and every verified inbound webhook, newest first.
 *
 * Bodies are stored already redacted — the header values and any known secret
 * are replaced before the row is written, not before it is rendered — so this
 * page is safe to leave open on a shared screen.
 */
export default async function IntegrationLogPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; ok?: string }>;
}) {
  await requireView("integrations:read");
  const params = await searchParams;

  const conds: SQL[] = [];
  if (params.provider) conds.push(eq(integrationEvents.provider, params.provider));
  if (params.ok === "failed") conds.push(eq(integrationEvents.ok, false));
  if (params.ok === "ok") conds.push(eq(integrationEvents.ok, true));

  const rows = await db
    .select()
    .from(integrationEvents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(integrationEvents.createdAt))
    .limit(EVENT_LOG_KEEP);

  return (
    <div className="space-y-3">
      <AutoSubmit action="/admin/integrations/log">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="log-provider" className="a-label">
              Provider
            </label>
            <select id="log-provider" name="provider" className="a-select" defaultValue={params.provider ?? ""}>
              <option value="">All providers</option>
              {PROVIDER_LIST.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="log-ok" className="a-label">
              Outcome
            </label>
            <select id="log-ok" name="ok" className="a-select" defaultValue={params.ok ?? ""}>
              <option value="">Everything</option>
              <option value="ok">Succeeded</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <noscript>
            <button type="submit" className="a-btn a-btn-xs">
              Filter
            </button>
          </noscript>
        </div>
      </AutoSubmit>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="No calls logged yet">
            Every call an integration makes lands here, including dry-run calls. The last {EVENT_LOG_KEEP} per provider
            are kept.
          </EmptyState>
        </Card>
      ) : (
        <EventLogTable
          rows={rows.map((row) => ({
            id: row.id,
            provider: providerName(row.provider),
            direction: row.direction,
            operation: row.operation,
            method: row.method,
            endpoint: row.endpoint,
            responseStatus: row.responseStatus,
            ok: row.ok,
            dryRun: row.dryRun,
            durationMs: row.durationMs,
            error: row.error,
            createdAt: row.createdAt.toISOString(),
            requestHeaders: row.requestHeaders,
            requestBody: row.requestBody,
            responseBody: row.responseBody,
          }))}
        />
      )}
    </div>
  );
}
