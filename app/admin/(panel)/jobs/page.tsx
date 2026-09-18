import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { jobCounts, jobTypes, listJobs, JOBS_PAGE_SIZE } from "@/lib/jobs/queue";
import { JOB_LABEL } from "@/lib/jobs/types";
import type { JobStatus } from "@/lib/db/schema";
import { PageHeader, StatTile } from "@/components/admin/ui";
import { AutoSubmit } from "@/components/admin/client-ui";
import { JobsTable } from "@/components/admin/JobsTable";

export const metadata = { title: "Jobs" };
export const dynamic = "force-dynamic";

const STATUSES: JobStatus[] = ["queued", "running", "succeeded", "failed", "dead"];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; page?: string }>;
}) {
  const ctx = await requireView("jobs:read");
  const params = await searchParams;
  const status = STATUSES.includes(params.status as JobStatus) ? (params.status as JobStatus) : undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [{ rows, total }, counts, types] = await Promise.all([
    listJobs({ type: params.type || undefined, status, page }),
    jobCounts(),
    jobTypes(),
  ]);

  const pages = Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE));
  const build = (next: number) => {
    const qs = new URLSearchParams();
    if (params.type) qs.set("type", params.type);
    if (status) qs.set("status", status);
    if (next > 1) qs.set("page", String(next));
    const q = qs.toString();
    return q ? `/admin/jobs?${q}` : "/admin/jobs";
  };

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="Every outbound integration runs through this queue. A dead job needs a person; everything else retries itself."
        actions={
          <Link href="/admin/integrations" className="a-btn a-btn-xs">
            Integrations
          </Link>
        }
      />

      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Queued" value={String(counts.queued)} href="/admin/jobs?status=queued" />
        <StatTile label="Running" value={String(counts.running)} href="/admin/jobs?status=running" />
        <StatTile label="Succeeded" value={String(counts.succeeded)} href="/admin/jobs?status=succeeded" tone="ok" />
        <StatTile
          label="Retrying"
          value={String(counts.failed)}
          href="/admin/jobs?status=failed"
          tone={counts.failed > 0 ? "warn" : undefined}
        />
        <StatTile
          label="Dead"
          value={String(counts.dead)}
          sub="Out of attempts"
          href="/admin/jobs?status=dead"
          tone={counts.dead > 0 ? "danger" : undefined}
        />
      </div>

      <div className="my-3">
        <AutoSubmit action="/admin/jobs">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="job-type" className="a-label">
                Type
              </label>
              <select id="job-type" name="type" className="a-select" defaultValue={params.type ?? ""}>
                <option value="">All types</option>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {JOB_LABEL[type] ?? type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="job-status" className="a-label">
                Status
              </label>
              <select id="job-status" name="status" className="a-select" defaultValue={status ?? ""}>
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <noscript>
              <button type="submit" className="a-btn a-btn-xs">
                Filter
              </button>
            </noscript>
          </div>
        </AutoSubmit>
      </div>

      <JobsTable rows={rows} canWrite={can(ctx.user.role, "jobs:write")} />

      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-3 flex items-center gap-2 text-[11.5px]">
          {page > 1 ? (
            <Link href={build(page - 1)} className="a-btn a-btn-xs">
              &larr; Previous
            </Link>
          ) : null}
          <span className="text-[var(--a-soft)]">
            Page {page} of {pages} &middot; {total} jobs
          </span>
          {page < pages ? (
            <Link href={build(page + 1)} className="a-btn a-btn-xs">
              Next &rarr;
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
