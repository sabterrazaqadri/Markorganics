import { requireView } from "@/lib/admin/session";
import { PageHeader, Card } from "@/components/admin/ui";
import { CsvImporter } from "@/components/admin/CsvImporter";
import { CSV_COLUMNS } from "@/lib/admin/product-csv";

export const metadata = { title: "Import and export" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireView("products:write");

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/products", label: "Products" }}
        title="Import and export"
        subtitle="One row per variant. A product with three sizes is three rows sharing a handle."
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <CsvImporter />

        <div className="space-y-3">
          <Card title="Export">
            <div className="space-y-2 p-3">
              <a href="/api/admin/products/export" className="a-btn a-btn-xs w-full" download>
                Download all products
              </a>
              <a href="/api/admin/products/export?template=1" className="a-btn a-btn-xs w-full" download>
                Download a blank template
              </a>
            </div>
          </Card>

          <Card title="Columns">
            <ul className="a-mono space-y-0.5 p-3 text-[var(--a-soft)]">
              {CSV_COLUMNS.map((c) => (
                <li key={c}>
                  {c}
                  {["handle", "variant_sku", "variant_label", "variant_price"].includes(c) ? (
                    <span className="ml-1 text-[var(--a-danger)]">*</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="a-hint px-3 pb-3">
              * required. Lists such as tags, benefits and images are separated with a pipe: <code className="a-mono">a|b|c</code>.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
