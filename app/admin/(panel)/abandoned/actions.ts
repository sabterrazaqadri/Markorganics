"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";
import { run, type ActionResult } from "@/lib/admin/result";
import { setAbandonedStatus } from "@/lib/admin/abandoned";

export async function setAbandonedStatusAction(
  id: string,
  status: "open" | "dismissed",
): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("abandoned:write");
    await setAbandonedStatus(id, status);
    await audit(ctx, {
      action: "abandoned.status",
      entityType: "abandoned_checkout",
      entityId: id,
      after: { status },
    });
    revalidatePath("/admin/abandoned");
    return null;
  });
}
