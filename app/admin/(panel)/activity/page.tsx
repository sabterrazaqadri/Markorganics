import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireView } from "@/lib/admin/session";
import { listActivity } from "@/lib/admin/audit";
import { listUsers } from "@/lib/admin/users";
import { activityFilterSchema } from "@/lib/validation/admin";
import { CursorPager, DateCell, DiffTable, EmptyState, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Activity log" };
export const dynamic = "force-dynamic";

const ENTITY_HREF: Record<string, (id: string) => string> = {
  order: (id) => `/admin/orders/${id}`,
  product: (id) => `/admin/products/${id}`,
  customer: (id) => `/admin/customers/${id}`,
  collection: (id) => `/admin/collections/${id}`,
  discount: (id) => `/admin/discounts/${id}`,
  segment: (id) => `/admin/segments/${id}`,
  page: (id) => `/admin/content/pages/${id}`,
  blog_post: (id) => `/admin/content/blog/${id}`,
  draft_order: (id) => `/admin/drafts/${id}`,
  variant: (id) => `/admin/inventory/${id}`,
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireView("activity:read");
  const sp = await searchParams;
  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) raw[k] = value;
  }
  const filter = activityFilterSchema.safeParse(raw).data ?? activityFilterSchema.parse({});

  const [{ rows, nextCursor }, staff, facets] = await Promise.all([
    listActivity(filter),
    listUsers(),
    db.execute<{ entity_type: string; action: string }>(sql`
      SELECT DISTINCT entity_type, action FROM audit_logs ORDER BY entity_type, action LIMIT 200
    `),
  ]);

  const entityTypes = [...new Set((facets.rows ?? []).map((r) => r.entity_type))];
  const actions = [...new Set((facets.rows ?? []).map((r) => r.action))];

  return (
    <>
      <PageHeader
        title="Activity log"
        subtitle="Every mutation, with who did it, what changed, when and from which IP. This is how disputes get settled."
      />

      <form method="get" className="a-card mb-3 grid gap-2 p-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="sm:col-span-2">
          <label htmlFor="q" className="a-label">
            Search
          </label>
          <input id="q" name="q" className="a-input" defaultValue={filter.q ?? ""} placeholder="Order number, email or id" />
        </div>
        <div>
          <label htmlFor="userId" className="a-label">
            Staff
          </label>
          <select id="userId" name="userId" className="a-select" defaultValue={filter.userId ?? ""}>
            <option value="">Anyone</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="entityType" className="a-label">
            Entity
          </label>
          <select id="entityType" name="entityType" className="a-select" defaultValue={filter.entityType ?? ""}>
            <option value="">Anything</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="action" className="a-label">
            Action
          </label>
          <select id="action" name="action" className="a-select" defaultValue={filter.action ?? ""}>
            <option value="">Any</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="from" className="a-label">
              From
            </label>
            <input id="from" name="from" type="date" className="a-input" defaultValue={filter.from ?? ""} />
          </div>
          <div>
            <label htmlFor="to" className="a-label">
              To
            </label>
            <input id="to" name="to" type="date" className="a-input" defaultValue={filter.to ?? ""} />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="a-btn a-btn-primary">
            Filter
          </button>
          <Link href="/admin/activity" className="a-btn">
            Clear
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState title="Nothing logged yet">
            Every change made from here on is recorded. Clear the filters if you expected to see something.
          </EmptyState>
        </div>
      ) : (
        <div className="a-card a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>When</th>
                <th style={{ width: 150 }}>Who</th>
                <th style={{ width: 150 }}>Action</th>
                <th style={{ width: 180 }}>Entity</th>
                <th>Change</th>
                <th style={{ width: 110 }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = row.entityId ? ENTITY_HREF[row.entityType]?.(row.entityId) : undefined;
                return (
                  <tr key={row.id}>
                    <td>
                      <DateCell value={row.createdAt} />
                    </td>
                    <td className="max-w-[150px] truncate">
                      {row.userName ?? "—"}
                      <span className="block text-[11px] text-[var(--a-soft)]">{row.userEmail}</span>
                    </td>
                    <td>
                      <span className="a-badge a-badge-neutral">{row.action}</span>
                    </td>
                    <td className="max-w-[180px] truncate">
                      {href ? (
                        <Link href={href} prefetch={false} className="text-[var(--a-info)] hover:underline">
                          {row.entityLabel ?? row.entityType}
                        </Link>
                      ) : (
                        (row.entityLabel ?? row.entityType)
                      )}
                      <span className="block text-[11px] text-[var(--a-soft)]">{row.entityType}</span>
                    </td>
                    <td>
                      <DiffTable before={row.before} after={row.after} />
                    </td>
                    <td className="a-mono text-[var(--a-soft)]">{row.ip ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CursorPager basePath="/admin/activity" params={raw} nextCursor={nextCursor} hasCursor={Boolean(filter.cursor)} />
    </>
  );
}
