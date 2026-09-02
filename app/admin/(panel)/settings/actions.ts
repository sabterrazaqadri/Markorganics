"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { metafieldDefinitions, notificationTemplates, users, type UserRole } from "@/lib/db/schema";
import { requirePermission } from "@/lib/admin/session";
import { audit, diff } from "@/lib/admin/audit";
import { ActionError, run, type ActionResult } from "@/lib/admin/result";
import { revalidateSettings } from "@/lib/admin/revalidate";
import { getSettings, writeSetting } from "@/lib/settings";
import {
  changePasswordSchema,
  createUserSchema,
  deliverySettingsSchema,
  metafieldDefinitionSchema,
  notificationTemplateSchema,
  resetPasswordSchema,
  storeSettingsSchema,
  updateUserSchema,
} from "@/lib/validation/admin";
import { createUser, findUserByEmail, hashPassword, revokeAllSessions, verifyPassword } from "@/lib/admin/users";
import type { z } from "zod";

/* -------------------------------------------------------------- settings */

export async function saveStoreSettingsAction(
  input: z.input<typeof storeSettingsSchema>,
): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("settings:write");
    const values = storeSettingsSchema.parse(input);
    const before = (await getSettings()).store;

    await writeSetting("store", values);
    const d = diff(before as unknown as Record<string, unknown>, values as unknown as Record<string, unknown>);
    await audit(ctx, { action: "settings.store", entityType: "settings", entityId: "store", before: d.before, after: d.after });

    revalidateSettings();
    revalidatePath("/admin/settings");
    return null;
  });
}

export async function saveDeliverySettingsAction(
  input: z.input<typeof deliverySettingsSchema>,
): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("settings:write");
    const values = deliverySettingsSchema.parse(input);
    const before = (await getSettings()).delivery;

    const stored = {
      flatRatePaisa: Math.round(values.flatRateRupees * 100),
      freeThresholdPaisa: Math.round(values.freeThresholdRupees * 100),
      cityRates: values.cityRates.map((r) => ({ city: r.city, feePaisa: Math.round(r.feeRupees * 100) })),
      blockedCities: values.blockedCities,
    };

    await writeSetting("delivery", stored);
    const d = diff(before as unknown as Record<string, unknown>, stored as unknown as Record<string, unknown>);
    await audit(ctx, { action: "settings.delivery", entityType: "settings", entityId: "delivery", before: d.before, after: d.after });

    revalidateSettings();
    revalidatePath("/admin/settings/delivery");
    return null;
  });
}

export async function saveTemplateAction(
  input: z.input<typeof notificationTemplateSchema>,
): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("settings:write");
    const values = notificationTemplateSchema.parse(input);

    await db
      .update(notificationTemplates)
      .set({ subject: values.subject, body: values.body, isEnabled: values.isEnabled, updatedAt: new Date() })
      .where(eq(notificationTemplates.key, values.key));

    await audit(ctx, {
      action: "settings.template",
      entityType: "notification_template",
      entityId: values.key,
      entityLabel: values.key,
      after: { isEnabled: values.isEnabled },
    });
    revalidatePath("/admin/settings/notifications");
    return null;
  });
}

/* ------------------------------------------------------------ metafields */

export async function saveMetafieldAction(
  input: z.input<typeof metafieldDefinitionSchema>,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("settings:write");
    const values = metafieldDefinitionSchema.parse(input);

    const clash = await db.query.metafieldDefinitions.findFirst({
      where: and(eq(metafieldDefinitions.key, values.key), isNull(metafieldDefinitions.deletedAt)),
      columns: { id: true },
    });
    if (clash && clash.id !== values.id) throw new ActionError(`The key "${values.key}" is already defined.`);

    let id = values.id;
    const row = { key: values.key, name: values.name, type: values.type, description: values.description, updatedAt: new Date() };
    if (id) {
      await db.update(metafieldDefinitions).set(row).where(eq(metafieldDefinitions.id, id));
    } else {
      const [created] = await db
        .insert(metafieldDefinitions)
        .values({ ...row, ownerType: "product" })
        .returning({ id: metafieldDefinitions.id });
      id = created.id;
    }

    await audit(ctx, {
      action: values.id ? "metafield.update" : "metafield.create",
      entityType: "metafield_definition",
      entityId: id,
      entityLabel: values.name,
      after: { key: values.key, type: values.type },
    });
    revalidatePath("/admin/settings/metafields");
    return { id: id! };
  });
}

export async function deleteMetafieldAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("settings:write");
    await db.update(metafieldDefinitions).set({ deletedAt: new Date() }).where(eq(metafieldDefinitions.id, id));
    await audit(ctx, { action: "metafield.delete", entityType: "metafield_definition", entityId: id });
    revalidatePath("/admin/settings/metafields");
    return null;
  });
}

/* ------------------------------------------------------------------ staff */

export async function createStaffAction(input: z.input<typeof createUserSchema>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("staff:write");
    const values = createUserSchema.parse(input);

    if (await findUserByEmail(values.email)) throw new ActionError("That email already has an account.");

    const user = await createUser({ ...values, createdById: ctx.user.id });
    await audit(ctx, {
      action: "user.create",
      entityType: "user",
      entityId: user.id,
      entityLabel: user.email,
      after: { role: user.role, name: user.name },
    });
    revalidatePath("/admin/settings/staff");
    return { id: user.id };
  });
}

export async function updateStaffAction(input: z.input<typeof updateUserSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("staff:write");
    const values = updateUserSchema.parse(input);

    const before = await db.query.users.findFirst({ where: eq(users.id, values.id) });
    if (!before) throw new ActionError("Staff member not found.");

    // The last active Owner must stay an active Owner, or nobody can sign in.
    if (before.role === "owner" && (values.role !== "owner" || values.status !== "active")) {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, "owner"), eq(users.status, "active"), isNull(users.deletedAt), ne(users.id, values.id)));
      if (n === 0) throw new ActionError("There must always be one active Owner.");
    }

    await db
      .update(users)
      .set({ name: values.name, role: values.role as UserRole, status: values.status, updatedAt: new Date() })
      .where(eq(users.id, values.id));

    // A suspended account should not keep a live session.
    if (values.status === "suspended") await revokeAllSessions(values.id);

    await audit(ctx, {
      action: "user.update",
      entityType: "user",
      entityId: values.id,
      entityLabel: before.email,
      before: { role: before.role, status: before.status, name: before.name },
      after: { role: values.role, status: values.status, name: values.name },
    });
    revalidatePath("/admin/settings/staff");
    return null;
  });
}

export async function resetStaffPasswordAction(input: z.input<typeof resetPasswordSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("staff:write");
    const values = resetPasswordSchema.parse(input);

    const target = await db.query.users.findFirst({ where: eq(users.id, values.id) });
    if (!target) throw new ActionError("Staff member not found.");

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(values.password), updatedAt: new Date() })
      .where(eq(users.id, values.id));
    await revokeAllSessions(values.id);

    await audit(ctx, {
      action: "user.reset_password",
      entityType: "user",
      entityId: values.id,
      entityLabel: target.email,
      after: { sessionsRevoked: true },
    });
    revalidatePath("/admin/settings/staff");
    return null;
  });
}

export async function deleteStaffAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("staff:write");
    if (id === ctx.user.id) throw new ActionError("You cannot remove your own account.");

    const target = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!target) throw new ActionError("Staff member not found.");

    if (target.role === "owner") {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.role, "owner"), eq(users.status, "active"), isNull(users.deletedAt), ne(users.id, id)));
      if (n === 0) throw new ActionError("There must always be one active Owner.");
    }

    await db
      .update(users)
      .set({ deletedAt: new Date(), status: "suspended", updatedAt: new Date() })
      .where(eq(users.id, id));
    await revokeAllSessions(id);

    await audit(ctx, {
      action: "user.delete",
      entityType: "user",
      entityId: id,
      entityLabel: target.email,
      after: { deleted: true },
    });
    revalidatePath("/admin/settings/staff");
    return null;
  });
}

/* --------------------------------------------------------------- account */

export async function changeOwnPasswordAction(
  input: z.input<typeof changePasswordSchema>,
): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("orders:read");
    const values = changePasswordSchema.parse(input);

    if (!(await verifyPassword(values.currentPassword, ctx.user.passwordHash))) {
      throw new ActionError("That is not your current password.");
    }

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(values.newPassword), updatedAt: new Date() })
      .where(eq(users.id, ctx.user.id));

    await audit(ctx, {
      action: "user.change_password",
      entityType: "user",
      entityId: ctx.user.id,
      entityLabel: ctx.user.email,
    });
    return null;
  });
}

export async function signOutEverywhereAction(): Promise<ActionResult<{ revoked: number }>> {
  return run(async () => {
    const ctx = await requirePermission("orders:read");
    const revoked = await revokeAllSessions(ctx.user.id);
    await audit(ctx, {
      action: "user.revoke_sessions",
      entityType: "user",
      entityId: ctx.user.id,
      entityLabel: ctx.user.email,
      after: { revoked },
    });
    return { revoked };
  });
}
