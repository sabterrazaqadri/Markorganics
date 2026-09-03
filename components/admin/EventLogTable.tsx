"use client";

import { useState } from "react";
import { Card, DateCell } from "./ui";
import { Modal } from "./client-ui";

export interface EventLogRow {
  id: string;
  provider: string;
  direction: string;
  operation: string;
  method: string;
  endpoint: string;
  responseStatus: number | null;
  ok: boolean;
  dryRun: boolean;
  durationMs: number;
  error: string | null;
  createdAt: string;
  requestHeaders: unknown;
  requestBody: unknown;
  responseBody: unknown;
}

/**
 * The call log.
 *
 * Everything shown here was redacted on the way into the database, so opening
 * a row can never reveal a token — the value was already gone before it was
 * written.
 */
export function EventLogTable({ rows }: { rows: EventLogRow[] }) {
  const [open, setOpen] = useState<EventLogRow | null>(null);

  return (
    <>
      <Card>
        <div className="a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Provider</th>
                <th>Operation</th>
                <th>Endpoint</th>
                <th className="a-num">Status</th>
                <th className="a-num">Took</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <DateCell value={row.createdAt} />
                  </td>
                  <td>
                    {row.provider}
                    {row.dryRun ? <span className="a-badge a-badge-info ml-1">dry</span> : null}
                    {row.direction === "inbound" ? <span className="a-badge a-badge-neutral ml-1">in</span> : null}
                  </td>
                  <td>
                    <button type="button" className="a-btn-link text-left" onClick={() => setOpen(row)}>
                      {row.operation || row.method}
                    </button>
                    {row.error ? (
                      <div className="max-w-[280px] truncate text-[10.5px] text-[var(--a-danger)]" title={row.error}>
                        {row.error}
                      </div>
                    ) : null}
                  </td>
                  <td className="a-mono max-w-[280px] truncate text-[11px] text-[var(--a-soft)]" title={row.endpoint}>
                    {row.endpoint}
                  </td>
                  <td className="a-num">
                    <span className={`a-badge ${row.ok ? "a-badge-ok" : "a-badge-danger"}`}>
                      {row.responseStatus ?? "—"}
                    </span>
                  </td>
                  <td className="a-num">{row.durationMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open ? `${open.provider} · ${open.operation}` : ""}
        width={720}
      >
        {open ? (
          <div className="space-y-3 text-[12px]">
            <div>
              <p className="a-label">
                {open.method} {open.responseStatus ?? "no response"} · {open.durationMs}ms
                {open.dryRun ? " · dry run" : ""}
              </p>
              <p className="a-mono break-all text-[11px]">{open.endpoint}</p>
            </div>
            {open.error ? (
              <div>
                <p className="a-label">Error</p>
                <p className="text-[var(--a-danger)]">{open.error}</p>
              </div>
            ) : null}
            <Block label="Request headers" value={open.requestHeaders} />
            <Block label="Request body" value={open.requestBody} />
            <Block label="Response" value={open.responseBody} />
            <p className="text-[11px] text-[var(--a-soft)]">
              Tokens, signatures and passwords were replaced before this row was stored.
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function Block({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <p className="a-label">{label}</p>
      <pre className="a-mono max-h-52 overflow-auto whitespace-pre-wrap rounded bg-[var(--a-warn-bg)] p-2 text-[11px]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
