import "server-only";
import { and, desc, eq, gte, ilike, lt, lte, or, type SQL } from "drizzle-orm";
import { db, type Db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import type { AdminContext } from "./session";

type Tx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Writes one audit row. Pass `tx` when the mutation is inside a transaction so
 * the log lands or rolls back with the change it describes.
 */
export async function audit(ctx: AdminContext, input: AuditInput, tx: Tx = db): Promise<void> {
  await tx.insert(auditLogs).values({
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    entityLabel: input.entityLabel ?? null,
    before: (input.before ?? null) as never,
    after: (input.after ?? null) as never,
    ip: ctx.ip,
  });
}

/** Field-level diff of two shallow records, keeping only what actually moved. */
export function diff<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
  keys?: (keyof T)[],
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  const fields = keys ?? ([
    ...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]),
  ] as (keyof T)[]);

  for (const key of fields) {
    const bv = before?.[key];
    const av = after?.[key];
    if (JSON.stringify(bv ?? null) === JSON.stringify(av ?? null)) continue;
    b[String(key)] = bv ?? null;
    a[String(key)] = av ?? null;
  }
  return { before: b, after: a };
}

/* -------------------------------------------------------------- reading */

export const ACTIVITY_PAGE_SIZE = 50;

export interface ActivityFilter {
  q?: string;
  userId?: string;
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
  cursor?: string;
}

export interface ActivityRow {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userEmail: string;
  userName: string | null;
}

export async function listActivity(
  filter: ActivityFilter,
): Promise<{ rows: ActivityRow[]; nextCursor: string | null }> {
  const conds: SQL[] = [];
  if (filter.q) {
    const q = `%${filter.q}%`;
    conds.push(
      or(ilike(auditLogs.entityLabel, q), ilike(auditLogs.userEmail, q), ilike(auditLogs.entityId, q))!,
    );
  }
  if (filter.userId) conds.push(eq(auditLogs.userId, filter.userId));
  if (filter.entityType) conds.push(eq(auditLogs.entityType, filter.entityType));
  if (filter.action) conds.push(eq(auditLogs.action, filter.action));
  if (filter.from) conds.push(gte(auditLogs.createdAt, new Date(`${filter.from}T00:00:00+05:00`)));
  if (filter.to) conds.push(lte(auditLogs.createdAt, new Date(`${filter.to}T23:59:59.999+05:00`)));
  if (filter.cursor) {
    const at = new Date(Number(filter.cursor));
    if (!Number.isNaN(at.getTime())) conds.push(lt(auditLogs.createdAt, at));
  }

  const rows = await db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      entityLabel: auditLogs.entityLabel,
      before: auditLogs.before,
      after: auditLogs.after,
      ip: auditLogs.ip,
      userEmail: auditLogs.userEmail,
      userName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(ACTIVITY_PAGE_SIZE + 1);

  const hasMore = rows.length > ACTIVITY_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, ACTIVITY_PAGE_SIZE) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last ? String(last.createdAt.getTime()) : null,
  };
}

export async function listActivityForEntity(entityType: string, entityId: string, limit = 20) {
  return db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      action: auditLogs.action,
      before: auditLogs.before,
      after: auditLogs.after,
      userEmail: auditLogs.userEmail,
      userName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
