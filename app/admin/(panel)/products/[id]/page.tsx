import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductByIdAdmin } from "@/lib/queries/products";
import {
  getBundleComponentsForProduct,
  getMetafieldValues,
  listComponentOptions,
  listMetafieldDefinitions,
} from "@/lib/queries/products-admin";
import { faqsToText } from "@/lib/validation/product";
import { listCollections, getCollectionsForProduct } from "@/lib/admin/collections";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { ProductForm, type ProductFormValues } from "@/components/admin/ProductForm";
import { PageHeader, ProductStatusPill, Card, DateCell } from "@/components/admin/ui";
import { listActivityForEntity } from "@/lib/admin/audit";
import { paisaToRupees, formatPKR } from "@/lib/money";

export const metadata = { title: "Edit product" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireView("products:read");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const p = await getProductByIdAdmin(id);
  if (!p) notFound();

  const [definitions, values, collections, memberships, activity, componentOptions, components] = await Promise.all([
    listMetafieldDefinitions(),
    getMetafieldValues(id),
    listCollections(),
    getCollectionsForProduct(id),
    listActivityForEntity("product", id, 8),
    listComponentOptions(),
    getBundleComponentsForProduct(id),
  ]);
  const ur = p.i18n?.ur ?? {};

  const initial: ProductFormValues = {
    name: p.name,
    slug: p.slug,
    family: p.family,
    status: p.status,
    productType: p.productType,
    vendor: p.vendor,
    tags: p.tags,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    shortDescription: p.shortDescription,
    longDescription: p.longDescription,
    howToUse: p.howToUse.join("\n"),
    ingredients: p.ingredients,
    benefits: p.benefits.join("\n"),
    images: p.images.join("\n"),
    isBestseller: p.isBestseller,
    sortOrder: String(p.sortOrder),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      barcode: v.barcode,
      priceRupees: String(paisaToRupees(v.pricePaisa)),
      compareAtRupees: v.compareAtPaisa ? String(paisaToRupees(v.compareAtPaisa)) : "",
      stock: String(v.stock),
      lowStockThreshold: String(v.lowStockThreshold),
    })),
    metafields: values,
    collectionIds: memberships.map((m) => m.id),
    faqs: faqsToText(p.faqs),
    urdu: {
      name: ur.name ?? "",
      shortDescription: ur.shortDescription ?? "",
      longDescription: ur.longDescription ?? "",
      howToUse: (ur.howToUse ?? []).join("\n"),
      ingredients: ur.ingredients ?? "",
      benefits: (ur.benefits ?? []).join("\n"),
      faqs: faqsToText(ur.faqs),
    },
    isBundle: p.isBundle,
    bundleComponents: components.map((c) => ({ variantId: c.variantId, quantity: String(c.quantity) })),
  };

  if (!can(ctx.user.role, "products:write")) {
    return (
      <>
        <PageHeader
          breadcrumb={{ href: "/admin/products", label: "Products" }}
          title={p.name}
          subtitle={`/${p.slug}`}
          actions={<ProductStatusPill status={p.status} />}
        />
        <Card title="Read only">
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Label</th>
                  <th className="a-num">Price</th>
                  <th className="a-num">Stock</th>
                </tr>
              </thead>
              <tbody>
                {p.variants.map((v) => (
                  <tr key={v.id}>
                    <td className="a-mono">{v.sku}</td>
                    <td>{v.label}</td>
                    <td className="a-num">{formatPKR(v.pricePaisa)}</td>
                    <td className="a-num">{v.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="p-3 text-[12px] text-[var(--a-soft)]">Your role can view products but not change them.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={{ href: "/admin/products", label: "Products" }}
        title={p.name}
        subtitle={`/${p.slug}`}
        actions={
          <>
            <ProductStatusPill status={p.status} />
            <Link href={`/products/${p.slug}`} target="_blank" rel="noopener" className="a-btn a-btn-xs">
              View in store ↗
            </Link>
          </>
        }
      />
      <ProductForm
        productId={p.id}
        initial={initial}
        definitions={definitions}
        collections={collections.map((c) => ({ id: c.id, title: c.title, type: c.type }))}
        componentOptions={componentOptions.filter((o) => !p.variants.some((v) => v.id === o.variantId))}
      />
      {activity.length ? (
        <div className="mt-3">
          <Card title="Recent changes">
            <ul className="divide-y divide-[var(--a-border)]">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[12px]">
                  <span>
                    <span className="a-badge a-badge-neutral mr-1.5">{a.action}</span>
                    {a.userName ?? a.userEmail}
                  </span>
                  <DateCell value={a.createdAt} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </>
  );
}
