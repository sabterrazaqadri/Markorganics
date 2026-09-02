import { requireView } from "@/lib/admin/session";
import { listMetafieldDefinitions } from "@/lib/queries/products-admin";
import { listCollections } from "@/lib/admin/collections";
import { EMPTY_FORM, ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "New product" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireView("products:write");
  const [definitions, collections] = await Promise.all([listMetafieldDefinitions(), listCollections()]);

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/products", label: "Products" }}
        title="New product"
        subtitle="Starts as a Draft, so nothing shows on the storefront until you set it Active."
      />
      <ProductForm
        initial={EMPTY_FORM}
        definitions={definitions}
        collections={collections.map((c) => ({ id: c.id, title: c.title, type: c.type }))}
      />
    </>
  );
}
