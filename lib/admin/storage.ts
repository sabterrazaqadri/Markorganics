import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { del, put } from "@vercel/blob";

/**
 * Where uploaded images live.
 *
 * With BLOB_READ_WRITE_TOKEN set (Vercel Blob) the bytes go to the blob store
 * and the stored URL is absolute. Without it — local development, or any host
 * with a writable disk — they land in /public/uploads. The media library only
 * ever sees the URL, so nothing else needs to know which one is in use.
 */
export function hasBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function storeImage(filename: string, bytes: Buffer, contentType: string): Promise<string> {
  if (hasBlobStorage()) {
    const blob = await put(`uploads/${filename}`, bytes, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return blob.url;
  }

  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), bytes);
  return `/uploads/${filename}`;
}

/** Best effort: a missing file is not a reason to keep the database row. */
export async function removeStoredImage(url: string): Promise<void> {
  try {
    if (url.startsWith("/uploads/")) {
      await unlink(join(process.cwd(), "public", url));
    } else if (hasBlobStorage() && /\.blob\.vercel-storage\.com\//.test(url)) {
      await del(url);
    }
  } catch {
    // ignore
  }
}
