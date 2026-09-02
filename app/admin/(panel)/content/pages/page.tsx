import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { listPagesAdmin } from "@/lib/content";
import { DateCell, EmptyState, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Pages" };
export const dynamic = "force-dynamic";

export default async function PagesListPage() {
  const ctx = await requireView("content:read");
  const rows = await listPagesAdmin();
  const writable = can(ctx.user.role, "content:write");

  return (
    <>
      <PageHeader
        title="Pages"
        subtitle="The storefront reads these from the database. System pages back fixed routes and cannot be deleted."
        actions={
          writable ? (
            <Link href="/admin/content/pages/new" className="a-btn a-btn-primary a-btn-xs">
              New page
            </Link>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState title="No pages yet">
            Run <code className="a-mono">npm run db:backfill</code> to seed the existing About, Privacy and Shipping
            pages, or create one here.
          </EmptyState>
        </div>
      ) : (
        <div className="a-card a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>URL</th>
                <th>Status</th>
                <th>Kind</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/admin/content/pages/${p.id}`}
                      prefetch={false}
                      className="font-medium text-[var(--a-info)] hover:underline"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="a-mono text-[var(--a-soft)]">/{p.slug}</td>
                  <td>
                    <span className={`a-badge ${p.status === "published" ? "a-badge-ok" : "a-badge-neutral"}`}>{p.status}</span>
                  </td>
                  <td className="text-[var(--a-soft)]">{p.isSystem ? "System" : "Custom"}</td>
                  <td>
                    <DateCell value={p.updatedAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
