"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { loginSchema } from "@/lib/validation/admin";
import {
  checkLockout,
  clearLoginFailures,
  countUsers,
  createUser,
  findUserByEmail,
  recordLoginFailure,
  verifyPassword,
} from "@/lib/admin/users";
import { createUserSession } from "@/lib/admin/session";

export interface LoginState {
  error?: string;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/**
 * Seeds the first Owner from the environment. A no-op the moment any user
 * exists, so it can never be used to mint a second account.
 */
export async function ensureSeedOwner(): Promise<{ seeded: boolean; email?: string }> {
  if ((await countUsers()) > 0) return { seeded: false };

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 8) return { seeded: false };

  const user = await createUser({
    email,
    password,
    name: process.env.ADMIN_NAME ?? "Owner",
    role: "owner",
  });
  await db.insert(auditLogs).values({
    userId: user.id,
    userEmail: user.email,
    action: "user.seed",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.email,
    after: { role: "owner", source: "environment seed" } as never,
  });
  return { seeded: true, email: user.email };
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const { email, password } = parsed.data;
  const ip = await clientIp();

  await ensureSeedOwner();

  const lockout = await checkLockout(email, ip);
  if (lockout.locked) {
    const mins = Math.max(1, Math.ceil(lockout.retryAfterMs / 60000));
    return { error: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  const user = await findUserByEmail(email);
  // Always run a comparison so a missing account is not faster than a wrong password.
  const hash = user?.passwordHash ?? "$2a$12$0000000000000000000000000000000000000000000000000000";
  const valid = await verifyPassword(password, hash);

  if (!user || !valid || user.status !== "active") {
    await recordLoginFailure(email, ip);
    return { error: "Wrong email or password." };
  }

  await clearLoginFailures(email, ip);
  await createUserSession(user.id);
  await db.insert(auditLogs).values({
    userId: user.id,
    userEmail: user.email,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.email,
    ip,
  });

  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin");
}
