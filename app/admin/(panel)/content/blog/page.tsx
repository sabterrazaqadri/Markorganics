import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { listPostsAdmin } from "@/lib/content";
import { DateCell, EmptyState, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Blog" };
export const dynamic = "force-dynamic";

export default async function BlogListPage() {
  const ctx = await requireView("content:read");
  const rows = await listPostsAdmin();
  const writable = can(ctx.user.role, "content:write");
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Blog"
        subtitle="Posts appear at /blog. A publish date in the future schedules the post without a cron job."
        actions={
          writable ? (
            <Link href="/admin/content/blog/new" className="a-btn a-btn-primary a-btn-xs">
              New post
            </Link>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState
            title="No posts yet"
            action={
              writable ? (
                <Link href="/admin/content/blog/new" className="a-btn a-btn-primary a-btn-xs">
                  New post
                </Link>
              ) : null
            }
          >
            The blog index and post routes are already live on the storefront; they show what you publish here.
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
                <th>Author</th>
                <th>Tags</th>
                <th>Publishes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const scheduled = p.status === "published" && p.publishedAt && p.publishedAt.getTime() > now;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/admin/content/blog/${p.id}`}
                        prefetch={false}
                        className="font-medium text-[var(--a-info)] hover:underline"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="a-mono text-[var(--a-soft)]">/blog/{p.slug}</td>
                    <td>
                      <span
                        className={`a-badge ${
                          scheduled ? "a-badge-info" : p.status === "published" ? "a-badge-ok" : "a-badge-neutral"
                        }`}
                      >
                        {scheduled ? "scheduled" : p.status}
                      </span>
                    </td>
                    <td className="text-[var(--a-soft)]">{p.authorName || "—"}</td>
                    <td>
                      <span className="flex flex-wrap gap-1">
                        {p.tags.slice(0, 3).map((t) => (
                          <span key={t} className="a-tag">
                            {t}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td>
                      <DateCell value={p.publishedAt} />
                    </td>
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
