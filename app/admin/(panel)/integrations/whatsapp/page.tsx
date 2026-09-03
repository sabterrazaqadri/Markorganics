import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { whatsappMessages, whatsappTemplates } from "@/lib/db/schema";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { formatPKR } from "@/lib/money";
import { displayPkPhone } from "@/lib/phone";
import { monthlyCost, unreadInboundCount } from "@/lib/whatsapp/client";
import { SITE_URL } from "@/config/commerce";
import { Card, DateCell, EmptyState, StatTile } from "@/components/admin/ui";
import { WhatsappTemplates } from "@/components/admin/WhatsappTemplates";

export const metadata = { title: "WhatsApp" };
export const dynamic = "force-dynamic";

export default async function WhatsappPage() {
  const ctx = await requireView("integrations:read");

  const [templates, cost, unread, recent] = await Promise.all([
    db.select().from(whatsappTemplates).orderBy(asc(whatsappTemplates.name)),
    monthlyCost(),
    unreadInboundCount(),
    db.select().from(whatsappMessages).orderBy(desc(whatsappMessages.createdAt)).limit(30),
  ]);

  const sentThisMonth = cost.rows.reduce((n, r) => n + r.count, 0);
  const inboundCount = await db
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(eq(whatsappMessages.direction, "inbound"))
    .limit(1);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <StatTile label={`Sent in ${cost.month}`} value={String(sentThisMonth)} sub="Outbound, excluding skipped" />
        <StatTile
          label="Estimated cost"
          value={formatPKR(cost.estimatePaisa)}
          sub="Indicative only — Meta's card is the truth"
        />
        <StatTile
          label="Unread replies"
          value={String(unread)}
          sub={inboundCount.length ? "From customers" : "Nothing inbound yet"}
          tone={unread > 0 ? "warn" : undefined}
        />
      </div>

      <Card title="Cost by category">
        <div className="p-3 text-[12px]">
          <p className="mb-2 text-[var(--a-soft)]">
            Meta&rsquo;s pricing changes on <strong>1 October 2026</strong>: utility messages inside the 24-hour
            service window and free-form service replies stop being free. The counts below are per category so the
            change is visible before the bill is.
          </p>
          <table className="a-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="a-num">Sent</th>
                <th className="a-num">Billable today</th>
              </tr>
            </thead>
            <tbody>
              {cost.rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-[var(--a-soft)]">
                    Nothing sent this month.
                  </td>
                </tr>
              ) : (
                cost.rows.map((row) => (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    <td className="a-num">{row.count}</td>
                    <td className="a-num">{row.billable}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <WhatsappTemplates
        canWrite={can(ctx.user.role, "integrations:write")}
        rows={templates.map((t) => ({
          id: t.id,
          name: t.name,
          language: t.language,
          category: t.category,
          body: t.body,
          variables: t.variables,
          approvalStatus: t.approvalStatus,
          trigger: t.trigger,
          isEnabled: t.isEnabled,
        }))}
      />

      <Card title="Recent messages">
        {recent.length === 0 ? (
          <EmptyState title="Nothing sent or received yet">
            Messages appear here as orders move. In dry run they are logged without leaving the building, which is a
            good way to check the wording before Meta approves it.
          </EmptyState>
        ) : (
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Direction</th>
                  <th>Phone</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Body</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <DateCell value={row.createdAt} />
                    </td>
                    <td className="text-[11.5px]">
                      {row.direction === "inbound" ? "In" : "Out"}
                      {row.dryRun ? <span className="a-badge a-badge-info ml-1">dry</span> : null}
                    </td>
                    <td className="a-mono text-[11.5px]">{displayPkPhone(`+${row.phone.replace(/^\+/, "")}`)}</td>
                    <td className="a-mono text-[11px]">{row.templateName || "—"}</td>
                    <td className="text-[11.5px]">
                      {row.status}
                      {row.error ? <div className="text-[10.5px] text-[var(--a-danger)]">{row.error}</div> : null}
                    </td>
                    <td className="max-w-[320px] truncate text-[11.5px] text-[var(--a-soft)]" title={row.body}>
                      {row.body}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Webhook">
        <div className="space-y-1 p-3 text-[12px]">
          <p className="text-[var(--a-soft)]">Paste this into Meta&rsquo;s webhook configuration:</p>
          <p className="a-mono break-all">{SITE_URL}/api/webhooks/whatsapp</p>
          <p className="text-[var(--a-soft)]">
            Use the verify token from the WhatsApp card on the{" "}
            <Link href="/admin/integrations" className="a-btn-link">
              providers tab
            </Link>
            , and subscribe to <span className="a-mono">messages</span>. Every delivery is signature-checked; a body
            that does not verify is dropped.
          </p>
        </div>
      </Card>
    </div>
  );
}
