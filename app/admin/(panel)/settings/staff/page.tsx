import { gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSessions } from "@/lib/db/schema";
import { requireView } from "@/lib/admin/session";
import { listUsers } from "@/lib/admin/users";
import { StaffManager, type StaffRow } from "@/components/admin/StaffManager";

export const metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const ctx = await requireView("staff:read");
  const users = await listUsers();

  const sessionRows = await db
    .select({ userId: userSessions.userId, n: sql<number>`count(*)::int` })
    .from(userSessions)
    .where(gt(userSessions.expiresAt, new Date()))
    .groupBy(userSessions.userId);
  const sessionsBy = new Map(sessionRows.map((r) => [r.userId, r.n]));

  const rows: StaffRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    sessions: sessionsBy.get(u.id) ?? 0,
  }));

  return <StaffManager rows={rows} currentUserId={ctx.user.id} />;
}
