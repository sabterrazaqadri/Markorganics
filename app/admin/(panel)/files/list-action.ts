"use server";

import { requirePermission } from "@/lib/admin/session";
import { listMedia } from "@/lib/admin/media";
import type { MediaFile } from "@/lib/db/schema";

export async function listMediaAction(query: string): Promise<MediaFile[]> {
  await requirePermission("files:read");
  const { rows } = await listMedia({ q: query });
  return rows;
}
