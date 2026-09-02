import { eq, gt, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSessions } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin/session";
import { ROLE_BLURB } from "@/lib/admin/permissions";
import { Card, DateCell, PageHeader, RolePill } from "@/components/admin/ui";
import { AccountForm } from "@/components/admin/AccountForm";

export const metadata = { title: "My account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const ctx = await requireAdmin();

  const [{ n: sessions }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userSessions)
    .where(and(eq(userSessions.userId, ctx.user.id), gt(userSessions.expiresAt, new Date())));

  return (
    <>
      <PageHeader title="My account" subtitle={ctx.user.email} actions={<RolePill role={ctx.user.role} />} />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Details">
          <dl className="grid gap-x-6 gap-y-2 p-3 text-[12.5px] sm:grid-cols-2">
            <div>
              <dt className="a-label">Name</dt>
              <dd>{ctx.user.name}</dd>
            </div>
            <div>
              <dt className="a-label">Role</dt>
              <dd>
                <RolePill role={ctx.user.role} />
                <span className="mt-1 block text-[11.5px] text-[var(--a-soft)]">{ROLE_BLURB[ctx.user.role]}</span>
              </dd>
            </div>
            <div>
              <dt className="a-label">Last sign-in</dt>
              <dd>{ctx.user.lastLoginAt ? <DateCell value={ctx.user.lastLoginAt} /> : "—"}</dd>
            </div>
            <div>
              <dt className="a-label">Active sessions</dt>
              <dd className="a-num" style={{ textAlign: "left" }}>
                {sessions}
              </dd>
            </div>
          </dl>
          <p className="a-hint px-3 pb-3">
            Only an Owner can change your name or role. Ask them if either is wrong.
          </p>
        </Card>

        <AccountForm sessions={sessions} />
      </div>
    </>
  );
}
