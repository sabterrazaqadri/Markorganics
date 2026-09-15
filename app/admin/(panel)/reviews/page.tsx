import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { listReviewsAdmin } from "@/lib/reviews";
import { getAllProductsAdmin } from "@/lib/queries/products";
import { REVIEW_STATUSES, type ReviewStatus } from "@/lib/db/schema";
import { DateCell, EmptyState, PageHeader } from "@/components/admin/ui";
import { ReviewRowActions } from "@/components/admin/ReviewRowActions";
import { AddReviewForm } from "@/components/admin/AddReviewForm";

export const metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

const BADGE: Record<ReviewStatus, string> = {
  pending: "a-badge-warn",
  approved: "a-badge-ok",
  rejected: "a-badge-neutral",
};

function isStatus(v: string | undefined): v is ReviewStatus {
  return (REVIEW_STATUSES as readonly string[]).includes(v ?? "");
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireView("reviews:read");
  const { status } = await searchParams;
  const view: ReviewStatus | "all" = isStatus(status) ? status : status === "all" ? "all" : "pending";
  const [rows, products] = await Promise.all([listReviewsAdmin(view), getAllProductsAdmin()]);
  const writable = can(ctx.user.role, "reviews:write");

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Only approved reviews are shown on the storefront and sent to Google as star ratings. Phone numbers are never published."
        actions={writable ? <AddReviewForm products={products.map((p) => ({ id: p.id, name: p.name }))} /> : null}
      />

      <div className="a-tabs mb-3">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <Link key={s} href={`/admin/reviews?status=${s}`} prefetch={false} className="a-tab" aria-current={view === s ? "page" : undefined}>
            {s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState title={view === "pending" ? "Nothing waiting" : "No reviews here"}>
            {view === "pending"
              ? "New reviews from the product pages land here for a quick check before they go live."
              : "Reviews customers leave on the product page, or that you add from WhatsApp, show up in this list."}
          </EmptyState>
        </div>
      ) : (
        <div className="a-card a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>Review</th>
                <th>Product</th>
                <th>Customer</th>
                <th>Status</th>
                <th>When</th>
                <th style={{ width: 220 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="max-w-md">
                    <p className="font-medium">
                      <span className="text-[var(--a-warn)]" aria-label={`${r.rating} stars`}>
                        {"★".repeat(r.rating)}
                        <span className="text-[var(--a-border)]">{"★".repeat(5 - r.rating)}</span>
                      </span>{" "}
                      {r.title}
                    </p>
                    <p className={`mt-0.5 whitespace-pre-line text-[12px] text-[var(--a-soft)] ${r.lang === "ur" ? "urdu text-[13px]" : ""}`} lang={r.lang}>
                      {r.body}
                    </p>
                    {r.reply ? <p className="mt-1 border-l-2 border-[var(--a-border)] pl-2 text-[11.5px]">Reply: {r.reply}</p> : null}
                  </td>
                  <td>
                    <Link href={`/products/${r.productSlug}#reviews`} target="_blank" rel="noopener" className="text-[var(--a-info)] hover:underline">
                      {r.productName}
                    </Link>
                  </td>
                  <td>
                    <p>{r.customerName}</p>
                    <p className="text-[11px] text-[var(--a-soft)]">
                      {r.city || "—"}
                      {r.isVerified ? " · verified buyer" : ""}
                      {r.source === "admin" ? " · added by staff" : ""}
                    </p>
                  </td>
                  <td>
                    <span className={`a-badge ${BADGE[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="text-[11.5px] text-[var(--a-soft)]">
                    <DateCell value={r.createdAt} />
                  </td>
                  <td>
                    <ReviewRowActions id={r.id} status={r.status} reply={r.reply} canWrite={writable} />
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
