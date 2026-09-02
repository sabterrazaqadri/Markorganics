import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationTemplates } from "@/lib/db/schema";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { EmptyState, Card } from "@/components/admin/ui";
import { TemplateForm } from "@/components/admin/SettingsForms";

export const metadata = { title: "Notification templates" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await requireView("settings:read");
  const rows = await db.select().from(notificationTemplates).orderBy(asc(notificationTemplates.key));
  const writable = can(ctx.user.role, "settings:write");

  return (
    <div className="space-y-3">
      <p className="rounded border border-[var(--a-border)] bg-[var(--a-warn-bg)] px-2.5 py-2 text-[12px] text-[var(--a-warn)]">
        <strong>Nothing is sent from here.</strong> These templates are stored and previewed only. WhatsApp and email
        delivery is a later pass; the copy is ready for it.
      </p>

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="No templates yet">
            Run <code className="a-mono">npm run db:backfill</code> to create the four order templates.
          </EmptyState>
        </Card>
      ) : (
        rows.map((t) => (
          <TemplateForm
            key={t.id}
            canWrite={writable}
            template={{
              key: t.key,
              name: t.name,
              channel: t.channel,
              subject: t.subject,
              body: t.body,
              isEnabled: t.isEnabled,
            }}
          />
        ))
      )}
    </div>
  );
}
