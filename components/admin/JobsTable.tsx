"use client";

import { useState } from "react";
import type { Job } from "@/lib/db/schema";
import { JOB_LABEL } from "@/lib/jobs/types";
import { Card, DateCell, EmptyState } from "./ui";
import { ConfirmButton, ErrorNote, Modal, useAction } from "./client-ui";
import { killJobAction, retryJobAction, runJobsNowAction } from "@/app/admin/(panel)/jobs/actions";

const STATUS_CLASS: Record<string, string> = {
  queued: "a-badge-neutral",
  running: "a-badge-info",
  succeeded: "a-badge-ok",
  failed: "a-badge-warn",
  dead: "a-badge-danger",
};

export function JobsTable({ rows, canWrite }: { rows: Job[]; canWrite: boolean }) {
  const { pending, error, runAction, show } = useAction();
  const [open, setOpen] = useState<Job | null>(null);

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState title="Nothing in the queue">
          Jobs appear here as orders are placed and shipments move. An empty queue with no dead rows is the healthy
          state.
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      <ErrorNote message={error} />
      {canWrite ? (
        <div className="mb-2">
          <button
            type="button"
            className="a-btn a-btn-xs"
            disabled={pending}
            onClick={() =>
              runAction(() => runJobsNowAction(), {
                onDone: (data) =>
                  show(`Claimed ${data.claimed}: ${data.succeeded} done, ${data.failed} retrying, ${data.dead} dead.`),
              })
            }
          >
            {pending ? "Running…" : "Run a batch now"}
          </button>
          <span className="ml-2 text-[11.5px] text-[var(--a-soft)]">
            The cron does this every minute. This button is for watching it work.
          </span>
        </div>
      ) : null}

      <Card>
        <div className="a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th className="a-num">Attempts</th>
                <th>Next run</th>
                <th>Created</th>
                <th>Last error</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((job) => (
                <tr key={job.id}>
                  <td>
                    <button type="button" className="a-btn-link text-left" onClick={() => setOpen(job)}>
                      {JOB_LABEL[job.type] ?? job.type}
                    </button>
                    <div className="a-mono text-[10.5px] text-[var(--a-soft)]">{job.type}</div>
                  </td>
                  <td>
                    <span className={`a-badge ${STATUS_CLASS[job.status] ?? "a-badge-neutral"}`}>{job.status}</span>
                  </td>
                  <td className="a-num">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td>
                    <DateCell value={job.runAfter} />
                  </td>
                  <td>
                    <DateCell value={job.createdAt} />
                  </td>
                  <td className="max-w-[280px] truncate text-[11.5px] text-[var(--a-danger)]" title={job.lastError ?? ""}>
                    {job.lastError ?? "—"}
                  </td>
                  <td className="whitespace-nowrap">
                    {canWrite ? (
                      <>
                        {job.status === "dead" || job.status === "failed" || job.status === "queued" ? (
                          <button
                            type="button"
                            className="a-btn a-btn-xs"
                            disabled={pending}
                            onClick={() => runAction(() => retryJobAction(job.id), { success: "Requeued" })}
                          >
                            Retry now
                          </button>
                        ) : null}
                        {job.status === "queued" || job.status === "running" ? (
                          <ConfirmButton
                            className="a-btn a-btn-xs a-btn-danger ml-1"
                            confirmLabel="Yes, kill it"
                            disabled={pending}
                            onConfirm={() => runAction(() => killJobAction(job.id), { success: "Job killed" })}
                          >
                            Kill
                          </ConfirmButton>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? JOB_LABEL[open.type] ?? open.type : ""} width={640}>
        {open ? (
          <div className="space-y-3 text-[12px]">
            <div>
              <p className="a-label">Idempotency key</p>
              <p className="a-mono break-all">{open.idempotencyKey ?? "—"}</p>
            </div>
            <div>
              <p className="a-label">Payload</p>
              <pre className="a-mono max-h-52 overflow-auto rounded bg-[var(--a-warn-bg)] p-2">
                {JSON.stringify(open.payload, null, 2)}
              </pre>
            </div>
            {open.result ? (
              <div>
                <p className="a-label">Result</p>
                <pre className="a-mono max-h-52 overflow-auto rounded bg-[var(--a-warn-bg)] p-2">
                  {JSON.stringify(open.result, null, 2)}
                </pre>
              </div>
            ) : null}
            {open.lastError ? (
              <div>
                <p className="a-label">Last error</p>
                <p className="text-[var(--a-danger)]">{open.lastError}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
