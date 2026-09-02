import "server-only";
import bcrypt from "bcryptjs";
import { and, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginAttempts, users, userSessions, type User, type UserRole } from "@/lib/db/schema";

const BCRYPT_ROUNDS = 12;

/** 10 failures inside the window locks the scope for LOCKOUT_MS. */
export const MAX_LOGIN_FAILURES = 10;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  return db.query.users.findFirst({
    where: and(eq(users.email, normalizeEmail(email)), isNull(users.deletedAt)),
  });
}

export async function findUserById(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: and(eq(users.id, id), isNull(users.deletedAt)) });
}

export async function countUsers(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(users).where(isNull(users.deletedAt));
  return row?.n ?? 0;
}

export async function listUsers(): Promise<User[]> {
  return db.query.users.findMany({
    where: isNull(users.deletedAt),
    orderBy: [desc(users.createdAt)],
  });
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  createdById?: string | null;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const [row] = await db
    .insert(users)
    .values({
      email: normalizeEmail(input.email),
      passwordHash: await hashPassword(input.password),
      name: input.name.trim(),
      role: input.role,
      createdById: input.createdById ?? null,
    })
    .returning();
  return row;
}

/* ------------------------------------------------------------- lockout */

function scopeKeys(email: string, ip: string): string[] {
  return [`email:${normalizeEmail(email)}`, `ip:${ip}`];
}

export interface LockoutState {
  locked: boolean;
  retryAfterMs: number;
}

export async function checkLockout(email: string, ip: string): Promise<LockoutState> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const keys = scopeKeys(email, ip);
  const rows = await db
    .select({ scope: loginAttempts.scope, n: count(), oldest: sql<Date>`min(${loginAttempts.createdAt})` })
    .from(loginAttempts)
    .where(and(gte(loginAttempts.createdAt, since), inArray(loginAttempts.scope, keys)))
    .groupBy(loginAttempts.scope);

  for (const row of rows) {
    if (row.n >= MAX_LOGIN_FAILURES) {
      const oldest = new Date(row.oldest).getTime();
      return { locked: true, retryAfterMs: Math.max(0, oldest + LOGIN_WINDOW_MS - Date.now()) };
    }
  }
  return { locked: false, retryAfterMs: 0 };
}

export async function recordLoginFailure(email: string, ip: string): Promise<void> {
  await db.insert(loginAttempts).values(scopeKeys(email, ip).map((scope) => ({ scope })));
  // Housekeeping so the table cannot grow without bound.
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}

export async function clearLoginFailures(email: string, ip: string): Promise<void> {
  const keys = scopeKeys(email, ip);
  await db.delete(loginAttempts).where(inArray(loginAttempts.scope, keys));
}

/* ------------------------------------------------------------ sessions */

export async function revokeAllSessions(userId: string): Promise<number> {
  const rows = await db.delete(userSessions).where(eq(userSessions.userId, userId)).returning({ id: userSessions.id });
  return rows.length;
}
