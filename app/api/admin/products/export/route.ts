import { NextResponse } from "next/server";
import { requirePermission, AdminForbiddenError, AdminUnauthorizedError } from "@/lib/admin/session";
import { csvTemplate, exportProductsCsv } from "@/lib/admin/product-csv";
import { audit } from "@/lib/admin/audit";

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await requirePermission("products:read");
  } catch (err) {
    const status = err instanceof AdminForbiddenError ? 403 : err instanceof AdminUnauthorizedError ? 401 : 500;
    return NextResponse.json({ error: "Not allowed" }, { status });
  }

  const template = new URL(req.url).searchParams.get("template") === "1";
  const csv = template ? csvTemplate() : await exportProductsCsv();
  if (!template) {
    await audit(ctx, { action: "product.export", entityType: "product", entityLabel: "catalogue CSV" });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${template ? "markorganic-product-template" : `markorganic-products-${stamp}`}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
