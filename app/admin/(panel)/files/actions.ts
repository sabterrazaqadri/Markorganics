"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";
import { ActionError, run, type ActionResult } from "@/lib/admin/result";
import { deleteMedia, findUsage, getMedia, indexExistingProductImages, registerMedia, setAlt } from "@/lib/admin/media";
import { mediaFromUrlSchema, mediaUpdateSchema } from "@/lib/validation/admin";
import type { MediaUsage } from "@/lib/admin/media";
import type { MediaFile } from "@/lib/db/schema";
import { unlink } from "node:fs/promises";
import { join } from "node:path";

export async function setAltAction(id: string, alt: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("files:write");
    const parsed = mediaUpdateSchema.parse({ id, alt });
    await setAlt(parsed.id, parsed.alt);
    await audit(ctx, { action: "media.alt", entityType: "media", entityId: parsed.id, after: { alt: parsed.alt } });
    revalidatePath("/admin/files");
    return null;
  });
}

export async function addFromUrlAction(url: string, alt: string): Promise<ActionResult<MediaFile>> {
  return run(async () => {
    const ctx = await requirePermission("files:write");
    const parsed = mediaFromUrlSchema.parse({ url, alt });
    const file = await registerMedia({
      url: parsed.url,
      filename: parsed.url.split("/").pop() ?? parsed.url,
      mimeType: "image/*",
      sizeBytes: 0,
      alt: parsed.alt,
      uploadedById: ctx.user.id,
    });
    await audit(ctx, { action: "media.add", entityType: "media", entityId: file.id, entityLabel: file.filename });
    revalidatePath("/admin/files");
    return file;
  });
}

export async function usageAction(id: string): Promise<ActionResult<MediaUsage[]>> {
  return run(async () => {
    await requirePermission("files:read");
    const file = await getMedia(id);
    if (!file) throw new ActionError("File not found.");
    return findUsage(file.url);
  });
}

/**
 * Media is the one thing genuinely deleted. The row goes, and so does the file
 * when it lives under /public/uploads.
 */
export async function deleteMediaAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("files:write");
    const file = await getMedia(id);
    if (!file) throw new ActionError("File not found.");

    const usage = await findUsage(file.url);
    if (usage.length > 0) {
      throw new ActionError(
        `Still used by ${usage.length} item${usage.length === 1 ? "" : "s"}: ${usage.slice(0, 3).map((u) => u.label).join(", ")}. Remove it there first.`,
      );
    }

    await deleteMedia(id);
    if (file.url.startsWith("/uploads/")) {
      await unlink(join(process.cwd(), "public", file.url)).catch(() => {});
    }
    await audit(ctx, {
      action: "media.delete",
      entityType: "media",
      entityId: id,
      entityLabel: file.filename,
      before: { url: file.url },
    });
    revalidatePath("/admin/files");
    return null;
  });
}

export async function indexImagesAction(): Promise<ActionResult<{ added: number }>> {
  return run(async () => {
    const ctx = await requirePermission("files:write");
    const added = await indexExistingProductImages();
    await audit(ctx, { action: "media.index", entityType: "media", after: { added } });
    revalidatePath("/admin/files");
    return { added };
  });
}
