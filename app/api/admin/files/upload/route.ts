import { NextResponse } from "next/server";
import sharp from "sharp";
import { requirePermission, AdminForbiddenError, AdminUnauthorizedError } from "@/lib/admin/session";
import { registerMedia } from "@/lib/admin/media";
import { storeImage } from "@/lib/admin/storage";
import { audit } from "@/lib/admin/audit";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

/**
 * Uploads are converted to WebP and handed to lib/admin/storage, which picks
 * Vercel Blob or the local /public/uploads folder. Everything else in the
 * media library works off the stored URL.
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

    const url = await storeImage(filename, output, "image/webp");
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
      { error: "Could not save the file. Check BLOB_READ_WRITE_TOKEN on the host, or add the image by URL instead." },
      { status: 500 },
    );
  }
}
