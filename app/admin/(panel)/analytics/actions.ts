"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requirePermission } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";
import { run, type ActionResult } from "@/lib/admin/result";
import { ANALYTICS_TAG } from "@/lib/admin/analytics";
import { createExpense, deleteExpense } from "@/lib/admin/expenses";
import { expenseEntrySchema } from "@/lib/validation/admin";
import { rupeesToPaisa } from "@/lib/money";

export async function addExpenseAction(input: {
  category: string;
  amountRupees: number | string;
  occurredOn: string;
  note?: string;
}): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("analytics:write");
    const parsed = expenseEntrySchema.parse(input);
    const id = await createExpense({
      category: parsed.category,
      amountPaisa: rupeesToPaisa(parsed.amountRupees),
      occurredOn: new Date(`${parsed.occurredOn}T12:00:00+05:00`),
      note: parsed.note,
      userId: ctx.user.id,
    });
    await audit(ctx, {
      action: "expense.create",
      entityType: "expense",
      entityId: id,
      after: { category: parsed.category, amountRupees: parsed.amountRupees, occurredOn: parsed.occurredOn },
    });
    revalidateTag(ANALYTICS_TAG);
    revalidatePath("/admin/analytics");
    return { id };
  });
}

export async function deleteExpenseAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("analytics:write");
    await deleteExpense(id);
    await audit(ctx, { action: "expense.delete", entityType: "expense", entityId: id });
    revalidateTag(ANALYTICS_TAG);
    revalidatePath("/admin/analytics");
    return null;
  });
}
