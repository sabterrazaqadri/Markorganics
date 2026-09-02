import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { listCollections } from "@/lib/admin/collections";
import { parseRules, describeRule } from "@/lib/admin/rules";
import { EmptyState, PageHeader, DateCell } from "@/components/admin/ui";
import { CollectionRowActions } from "@/components/admin/CollectionRowActions";

export const metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const ctx = await requireView("collections:read");
  const rows = await listCollections();
  const writable = can(ctx.user.role, "collections:write");

  return (
    <>
      <PageHeader
        title="Collections"
        subtitle="Hand-picked or rule-based groups of products. Exposed in the admin API today; storefront routes come later."
        actions={
          writable ? (
            <Link href="/admin/collections/new" className="a-btn a-btn-primary a-btn-xs">
              New collection
            </Link>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState
            title="No collections yet"
            action={
              writable ? (
                <Link href="/admin/collections/new" className="a-btn a-btn-primary a-btn-xs">
                  New collection
                </Link>
              ) : null
            }
          >
            Group products by hand, or write rules such as &ldquo;tag is winter&rdquo; and let the collection keep itself
            current.
          </EmptyState>
        </div>
      ) : (
        <div className="a-card a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>Collection</th>
                <th>Type</th>
                <th>Conditions</th>
                <th className="a-num">Products</th>
                <th>Published</th>
                <th>Updated</th>
                {writable ? <th style={{ width: 160 }} /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const rules = parseRules(c.rules);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/admin/collections/${c.id}`}
                        prefetch={false}
                        className="font-medium text-[var(--a-info)] hover:underline"
                      >
                        {c.title}
                      </Link>
                      <span className="block text-[11px] text-[var(--a-soft)]">/{c.slug}</span>
                    </td>
                    <td>
                      <span className="a-badge a-badge-neutral">{c.type === "manual" ? "Hand-picked" : "Automatic"}</span>
                    </td>
                    <td className="max-w-[280px] text-[11.5px] text-[var(--a-soft)]">
                      {c.type === "manual"
                        ? "—"
                        : rules.length === 0
                          ? "No conditions"
                          : `${c.rulesMatch === "all" ? "All" : "Any"}: ${rules.map((r) => describeRule(r, "product")).join("; ")}`}
                    </td>
                    <td className="a-num">{c.productCount}</td>
                    <td>
                      <span className={`a-badge ${c.isPublished ? "a-badge-ok" : "a-badge-neutral"}`}>
                        {c.isPublished ? "Published" : "Hidden"}
                      </span>
                    </td>
                    <td>
                      <DateCell value={c.updatedAt} />
                    </td>
                    {writable ? (
                      <td>
                        <CollectionRowActions id={c.id} isAutomatic={c.type === "automatic"} />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
