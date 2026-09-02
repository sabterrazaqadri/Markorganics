"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { destroyUserSession, getAdminContext } from "@/lib/admin/session";

export async function logout() {
  const ctx = await getAdminContext();
  if (ctx) {
    await db.insert(auditLogs).values({
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      action: "auth.logout",
      entityType: "user",
      entityId: ctx.user.id,
      entityLabel: ctx.user.email,
      ip: ctx.ip,
    });
  }
  await destroyUserSession();
  redirect("/admin/login");
}
