"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, customerSegments } from "@/lib/db/schema";
import { requirePermission } from "@/lib/admin/session";
import { audit, diff } from "@/lib/admin/audit";
import { ActionError, run, type ActionResult } from "@/lib/admin/result";
import { customerSchema, mergeCustomersSchema, segmentSchema } from "@/lib/validation/admin";
import { countCustomersMatching, getCustomerById, mergeCustomers } from "@/lib/admin/customers";
import type { Rule, RuleMatch } from "@/lib/admin/rules";
import type { z } from "zod";

export async function saveCustomerAction(input: z.input<typeof customerSchema>): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("customers:write");
    const values = customerSchema.parse(input);

    const before = await getCustomerById(values.id);
    if (!before) throw new ActionError("Customer not found.");

    await db
      .update(customers)
      .set({
        name: values.name,
        email: values.email || null,
        city: values.city,
        tags: values.tags,
        internalNote: values.internalNote,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, values.id));

    const after = await getCustomerById(values.id);
    const d = diff(
      before as unknown as Record<string, unknown>,
      after as unknown as Record<string, unknown>,
      ["name", "email", "city", "tags", "internalNote"],
    );
    await audit(ctx, {
      action: "customer.update",
      entityType: "customer",
      entityId: values.id,
      entityLabel: before.phone,
      before: d.before,
      after: d.after,
    });

    revalidatePath(`/admin/customers/${values.id}`);
    revalidatePath("/admin/customers");
    return null;
  });
}

export async function mergeCustomersAction(sourceId: string, targetId: string): Promise<ActionResult<{ moved: number }>> {
  return run(async () => {
    const ctx = await requirePermission("customers:write");
    const parsed = mergeCustomersSchema.parse({ sourceId, targetId });
    if (parsed.sourceId === parsed.targetId) throw new ActionError("Pick two different customers.");

    const [source, target] = await Promise.all([getCustomerById(parsed.sourceId), getCustomerById(parsed.targetId)]);
    if (!source || !target) throw new ActionError("One of those customers no longer exists.");
    if (source.mergedIntoId) throw new ActionError("That customer has already been merged.");

    const result = await mergeCustomers(parsed.sourceId, parsed.targetId);
    await audit(ctx, {
      action: "customer.merge",
      entityType: "customer",
      entityId: parsed.targetId,
      entityLabel: target.phone,
      before: { source: source.phone, sourceOrders: source.ordersCount },
      after: { target: target.phone, ordersMoved: result.moved },
    });

    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${parsed.targetId}`);
    return result;
  });
}

/* -------------------------------------------------------------- segments */

export async function saveSegmentAction(input: z.input<typeof segmentSchema>): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("customers:write");
    const values = segmentSchema.parse(input);

    const row = {
      name: values.name,
      description: values.description,
      rulesMatch: values.rulesMatch,
      rules: values.rules as never,
      updatedAt: new Date(),
    };

    let id = values.id;
    if (id) {
      await db.update(customerSegments).set(row).where(eq(customerSegments.id, id));
    } else {
      const [created] = await db.insert(customerSegments).values(row).returning({ id: customerSegments.id });
      id = created.id;
    }

    await audit(ctx, {
      action: values.id ? "segment.update" : "segment.create",
      entityType: "segment",
      entityId: id,
      entityLabel: values.name,
      after: { rules: values.rules, match: values.rulesMatch },
    });

    revalidatePath("/admin/segments");
    revalidatePath(`/admin/segments/${id}`);
    return { id: id! };
  });
}

export async function deleteSegmentAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("customers:write");
    const segment = await db.query.customerSegments.findFirst({
      where: and(eq(customerSegments.id, id), isNull(customerSegments.deletedAt)),
    });
    if (!segment) throw new ActionError("Segment not found.");
    await db.update(customerSegments).set({ deletedAt: new Date() }).where(eq(customerSegments.id, id));
    await audit(ctx, { action: "segment.delete", entityType: "segment", entityId: id, entityLabel: segment.name });
    revalidatePath("/admin/segments");
    return null;
  });
}

/** Live count for the segment editor. Compiles the rules without saving them. */
export async function previewSegmentAction(
  rules: Rule[],
  match: RuleMatch,
): Promise<ActionResult<{ total: number }>> {
  return run(async () => {
    await requirePermission("customers:read");
    return { total: await countCustomersMatching(rules, match) };
  });
}
