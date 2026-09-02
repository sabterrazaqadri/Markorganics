import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, userSessions, type User } from "@/lib/db/schema";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  randomToken,
  sha256Hex,
  signSessionCookie,
  verifySessionCookie,
} from "@/lib/auth";
import { can, type Permission } from "./permissions";

export class AdminUnauthorizedError extends Error {
  constructor() {
    super("You are not signed in.");
    this.name = "AdminUnauthorizedError";
  }
}

export class AdminForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super("Your role does not allow that.");
    this.name = "AdminForbiddenError";
  }
}

export interface AdminContext {
  user: User;
  sessionId: string;
  ip: string;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** Creates a DB-backed session row and sets the signed httpOnly cookie. */
export async function createUserSession(userId: string): Promise<void> {
  const sessionId = randomToken(32);
  const expiresAtSec = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS;
  const h = await headers();

  await db.insert(userSessions).values({
    userId,
    tokenHash: await sha256Hex(sessionId),
    expiresAt: new Date(expiresAtSec * 1000),
    ip: await clientIp(),
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  });
  await db.delete(userSessions).where(lt(userSessions.expiresAt, new Date()));
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, await signSessionCookie(sessionId, expiresAtSec), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
}

export async function destroyUserSession(): Promise<void> {
  const jar = await cookies();
  const verified = await verifySessionCookie(jar.get(ADMIN_COOKIE)?.value);
  if (verified) {
    await db.delete(userSessions).where(eq(userSessions.tokenHash, await sha256Hex(verified.sessionId)));
  }
  jar.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/**
 * Cookie signature + expiry + session row + active user. Memoised per request
 * so a page that checks permissions in ten places still costs one query.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const jar = await cookies();
  const verified = await verifySessionCookie(jar.get(ADMIN_COOKIE)?.value);
  if (!verified) return null;

  const row = await db
    .select({ user: users, sessionId: userSessions.id })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(and(eq(userSessions.tokenHash, await sha256Hex(verified.sessionId)), gt(userSessions.expiresAt, new Date())))
    .limit(1);

  const found = row[0];
  if (!found) return null;
  if (found.user.status !== "active" || found.user.deletedAt) return null;

  return { user: found.user, sessionId: verified.sessionId, ip: await clientIp() };
});

export async function requireAdmin(): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new AdminUnauthorizedError();
  return ctx;
}

/** The gate every mutation goes through. Never rely on hidden UI alone. */
export async function requirePermission(permission: Permission): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (!can(ctx.user.role, permission)) throw new AdminForbiddenError(permission);
  return ctx;
}

/**
 * The same check for a page render.
 *
 * A page cannot usefully throw at someone who typed a URL their role does not
 * cover, so this sends them to a page that explains it instead. Mutations
 * still go through requirePermission and still throw.
 */
export async function requireView(permission: Permission): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  if (!can(ctx.user.role, permission)) redirect(`/admin/no-access?p=${encodeURIComponent(permission)}`);
  return ctx;
}
