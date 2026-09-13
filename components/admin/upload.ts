"use client";

import type { MediaFile } from "@/lib/db/schema";

export const UPLOAD_LIMIT = 20;

/**
 * Posts each file to the upload route in turn and returns whatever made it.
 * Stops at the first failure so the error refers to a specific file.
 */
export async function uploadImages(
  fileList: FileList | File[] | null,
): Promise<{ files: MediaFile[]; error: string | null }> {
  const files: MediaFile[] = [];
  if (!fileList || fileList.length === 0) return { files, error: null };

  for (const file of Array.from(fileList).slice(0, UPLOAD_LIMIT)) {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/admin/files/upload", { method: "POST", body });
    const json = (await res.json().catch(() => ({}))) as { error?: string; file?: MediaFile };
    if (!res.ok || !json.file) {
      return { files, error: json.error ? `${file.name}: ${json.error}` : `${file.name}: upload failed.` };
    }
    files.push(json.file);
  }
  return { files, error: null };
}
