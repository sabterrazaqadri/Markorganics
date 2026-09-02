import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { requirePermission, AdminForbiddenError, AdminUnauthorizedError } from "@/lib/admin/session";
import { registerMedia } from "@/lib/admin/media";
import { audit } from "@/lib/admin/audit";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

/**
 * Uploads land in /public/uploads and are converted to WebP.
 *
 * This works in development and on any host with a writable disk. On a
 * read-only serverless filesystem the write fails and the response says so —
 * swapping this handler for a blob provider is the only change needed, because
 * everything else in the media library works off the stored URL.
 */
export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requirePermission("files:write");
  } catch (err) {
    const status = err instanceof AdminForbiddenError ? 403 : err instanceof AdminUnauthorizedError ? 401 : 500;
    return NextResponse.json({ error: "Not allowed" }, { status });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file was sent." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be 8 MB or smaller." }, { status: 400 });
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Upload a JPEG, PNG, WebP, AVIF or GIF image." }, { status: 400 });
  }

  const input = Buffer.from(await file.arrayBuffer());
  const alt = String(form?.get("alt") ?? "");

  try {
    const image = sharp(input, { animated: false });
    const meta = await image.metadata();
    const output = await image.rotate().webp({ quality: 82 }).toBuffer();

    const base = (file.name.replace(/\.[^.]+$/, "") || "image")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const filename = `${base || "image"}-${Date.now().toString(36)}.webp`;

    const dir = join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), output);

    const url = `/uploads/${filename}`;
    const media = await registerMedia({
      url,
      filename,
      mimeType: "image/webp",
      sizeBytes: output.byteLength,
      width: meta.width ?? null,
      height: meta.height ?? null,
      alt,
      uploadedById: ctx.user.id,
    });

    await audit(ctx, { action: "media.upload", entityType: "media", entityId: media.id, entityLabel: filename });
    return NextResponse.json({ ok: true, file: media }, { status: 201 });
  } catch (err) {
    console.error("upload failed", err);
    return NextResponse.json(
      { error: "Could not save the file. On a read-only host, add the image by URL instead." },
      { status: 500 },
    );
  }
}
