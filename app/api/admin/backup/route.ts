import { NextResponse } from "next/server";
import { requirePermission, AdminForbiddenError, AdminUnauthorizedError } from "@/lib/admin/session";
import { buildBackup } from "@/lib/admin/backup";
import { audit } from "@/lib/admin/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Owner-only full export. Password hashes are stripped inside buildBackup. */
export async function GET() {
  let ctx;
  try {
    ctx = await requirePermission("settings:write");
  } catch (err) {
    const status = err instanceof AdminForbiddenError ? 403 : err instanceof AdminUnauthorizedError ? 401 : 500;
    return NextResponse.json({ error: "Not allowed" }, { status });
  }

  const backup = await buildBackup();
  await audit(ctx, {
    action: "settings.backup",
    entityType: "settings",
    entityId: "backup",
    after: backup.counts,
  });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="markorganic-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
