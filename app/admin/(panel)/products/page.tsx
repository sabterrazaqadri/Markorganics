import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import {
  countProductsAdmin,
  distinctProductFacets,
  listProductsAdmin,
  productStatusCounts,
} from "@/lib/queries/products-admin";
import { listCollections } from "@/lib/admin/collections";
import { listSavedViews } from "@/lib/admin/saved-views";
import { productsFilterSchema } from "@/lib/validation/admin";
import { PRODUCT_STATUSES } from "@/lib/db/schema";
import { FAMILY_ORDER, FAMILIES } from "@/lib/catalog";
import { CursorPager, EmptyState, PageHeader, PRODUCT_STATUS_LABEL } from "@/components/admin/ui";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { SavedViewBar } from "@/components/admin/SavedViewBar";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminProductsPage({ searchParams }: { searchParams: SP }) {
  const ctx = await requireView("products:read");
  const sp = await searchParams;
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) raw[k] = value;
  }

  const parsed = productsFilterSchema.safeParse(raw);
  const filter = parsed.success ? parsed.data : productsFilterSchema.parse({});
  const writable = can(ctx.user.role, "products:write");

  const [{ rows, nextCursor }, counts, total, facets, collections, savedViews] = await Promise.all([
    listProductsAdmin(filter),
    productStatusCounts(),
    countProductsAdmin(filter),
    distinctProductFacets(),
    listCollections(),
    listSavedViews("products", ctx.user.id),
  ]);

  const queryString = new URLSearchParams(Object.entries(raw).filter(([k]) => k !== "cursor")).toString();

  const statusHref = (status?: string) => {
    const qs = new URLSearchParams(raw);
    qs.delete("cursor");
    if (status) qs.set("status", status);
    else qs.delete("status");
    const q = qs.toString();
    return q ? `/admin/products?${q}` : "/admin/products";
  };

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${total.toLocaleString("en-PK")} matching · ${counts.active ?? 0} active, ${counts.draft ?? 0} draft, ${counts.archived ?? 0} archived`}
        actions={
          writable ? (
            <>
              <Link href="/admin/products/import" className="a-btn a-btn-xs">
                Import / export
              </Link>
              <Link href="/admin/products/bulk" className="a-btn a-btn-xs">
                Bulk edit
              </Link>
              <Link href="/admin/products/new" className="a-btn a-btn-primary a-btn-xs">
                New product
              </Link>
            </>
          ) : null
        }
      />

      <nav aria-label="Product status" className="a-tabs mb-3">
        <Link href={statusHref()} className="a-tab" aria-current={!filter.status ? "page" : undefined}>
          All <span className="ml-1.5 text-[var(--a-soft)]">{counts.all ?? 0}</span>
        </Link>
        {PRODUCT_STATUSES.map((s) => (
          <Link key={s} href={statusHref(s)} className="a-tab" aria-current={filter.status === s ? "page" : undefined}>
            {PRODUCT_STATUS_LABEL[s]} <span className="ml-1.5 text-[var(--a-soft)]">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </nav>

      <SavedViewBar resource="products" views={savedViews} currentQuery={queryString} />

      <form method="get" className="a-card mb-3 grid gap-2 p-2 sm:grid-cols-3 lg:grid-cols-6">
        {filter.status ? <input type="hidden" name="status" value={filter.status} /> : null}
        <div className="sm:col-span-2">
          <label htmlFor="q" className="a-label">
            Search
          </label>
          <input id="q" name="q" className="a-input" defaultValue={filter.q ?? ""} placeholder="Name, slug or SKU" />
        </div>
        <div>
          <label htmlFor="family" className="a-label">
            Family
          </label>
          <select id="family" name="family" className="a-select" defaultValue={filter.family ?? ""}>
            <option value="">Any</option>
            {FAMILY_ORDER.map((f) => (
              <option key={f} value={f}>
                {FAMILIES[f].name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="productType" className="a-label">
            Type
          </label>
          <select id="productType" name="productType" className="a-select" defaultValue={filter.productType ?? ""}>
            <option value="">Any</option>
            {facets.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="vendor" className="a-label">
            Vendor
          </label>
          <select id="vendor" name="vendor" className="a-select" defaultValue={filter.vendor ?? ""}>
            <option value="">Any</option>
            {facets.vendors.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tag" className="a-label">
            Tag
          </label>
          <select id="tag" name="tag" className="a-select" defaultValue={filter.tag ?? ""}>
            <option value="">Any</option>
            {facets.tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="collectionId" className="a-label">
            Collection
          </label>
          <select id="collectionId" name="collectionId" className="a-select" defaultValue={filter.collectionId ?? ""}>
            <option value="">Any</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="stock" className="a-label">
            Stock
          </label>
          <select id="stock" name="stock" className="a-select" defaultValue={filter.stock ?? ""}>
            <option value="">Any</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="a-label">
            Sort
          </label>
          <select id="sort" name="sort" className="a-select" defaultValue={filter.sort}>
            <option value="name">Name</option>
            <option value="created">Newest</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="a-btn a-btn-primary">
            Filter
          </button>
          <Link href="/admin/products" className="a-btn">
            Clear
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState
            title="No products match"
            action={
              writable ? (
                <Link href="/admin/products/new" className="a-btn a-btn-primary a-btn-xs">
                  New product
                </Link>
              ) : null
            }
          >
            Clear the filters, or add a product. Only Active products appear on the storefront.
          </EmptyState>
        </div>
      ) : (
        <ProductsTable rows={rows} canWrite={writable} />
      )}

      <CursorPager basePath="/admin/products" params={raw} nextCursor={nextCursor} hasCursor={Boolean(filter.cursor)} />
    </>
  );
}
