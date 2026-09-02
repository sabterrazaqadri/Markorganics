import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { listPagesAdmin, POLICY_SLUGS } from "@/lib/content";
import { Card, DateCell, EmptyState } from "@/components/admin/ui";

export const metadata = { title: "Policies" };
export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  refund: "Refund policy",
  privacy: "Privacy policy",
  terms: "Terms of service",
  "shipping-returns": "Shipping and returns",
};

export default async function PoliciesPage() {
  await requireView("settings:read");
  const pages = await listPagesAdmin();
  const policies = POLICY_SLUGS.map((slug) => ({ slug, page: pages.find((p) => p.slug === slug) }));

  return (
    <Card title="Policies">
      {policies.every((p) => !p.page) ? (
        <EmptyState title="Policies are not seeded yet">
          Run <code className="a-mono">npm run db:backfill</code> to create the four policy pages from the copy already
          on the storefront.
        </EmptyState>
      ) : (
        <table className="a-table">
          <thead>
            <tr>
              <th>Policy</th>
              <th>URL</th>
              <th>Status</th>
              <th>Updated</th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {policies.map(({ slug, page }) => (
              <tr key={slug}>
                <td>{LABEL[slug]}</td>
                <td className="a-mono text-[var(--a-soft)]">/{slug}</td>
                <td>
                  {page ? (
                    <span className={`a-badge ${page.status === "published" ? "a-badge-ok" : "a-badge-neutral"}`}>
                      {page.status}
                    </span>
                  ) : (
                    <span className="a-badge a-badge-warn">missing</span>
                  )}
                </td>
                <td>{page ? <DateCell value={page.updatedAt} /> : "—"}</td>
                <td>
                  {page ? (
                    <Link href={`/admin/content/pages/${page.id}`} prefetch={false} className="a-btn-link">
                      Edit
                    </Link>
                  ) : (
                    <Link href="/admin/content/pages/new" prefetch={false} className="a-btn-link">
                      Create
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="a-hint p-3">
        Policies are ordinary pages with reserved slugs. The storefront renders them at their own routes.
      </p>
    </Card>
  );
}
