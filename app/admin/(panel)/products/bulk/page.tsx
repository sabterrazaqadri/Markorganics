import { requireView } from "@/lib/admin/session";
import { listProductsAdmin } from "@/lib/queries/products-admin";
import { productsFilterSchema } from "@/lib/validation/admin";
import { PageHeader, EmptyState } from "@/components/admin/ui";
import { BulkEditGrid, type BulkRow } from "@/components/admin/BulkEditGrid";
import { paisaToRupees } from "@/lib/money";

export const metadata = { title: "Bulk edit" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BulkEditPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; q?: string; status?: string }>;
}) {
  await requireView("products:write");
  const sp = await searchParams;
  const wanted = new Set((sp.ids ?? "").split(",").map((s) => s.trim()).filter((s) => UUID.test(s)));

  const filter = productsFilterSchema.parse({ q: sp.q, status: sp.status });
  const { rows } = await listProductsAdmin(filter);
  const products = wanted.size ? rows.filter((p) => wanted.has(p.id)) : rows;

  const gridRows: BulkRow[] = products.flatMap((p) =>
    p.variants.map((v, i) => ({
      productId: p.id,
      productName: p.name,
      productStatus: p.status,
      productTags: p.tags,
      family: p.family,
      isFirstVariant: i === 0,
      variantId: v.id,
      sku: v.sku,
      label: v.label,
      priceRupees: String(paisaToRupees(v.pricePaisa)),
      compareAtRupees: v.compareAtPaisa ? String(paisaToRupees(v.compareAtPaisa)) : "",
      stock: String(v.stock),
      lowStockThreshold: String(v.lowStockThreshold),
    })),
  );

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/products", label: "Products" }}
        title="Bulk edit"
        subtitle={
          wanted.size
            ? `${products.length} selected products`
            : "Every product on the first page. Select rows on the products list to narrow this down."
        }
      />

      {gridRows.length === 0 ? (
        <div className="a-card">
          <EmptyState title="Nothing to edit">Pick some products on the products list first.</EmptyState>
        </div>
      ) : (
        <BulkEditGrid rows={gridRows} />
      )}
    </>
  );
}
