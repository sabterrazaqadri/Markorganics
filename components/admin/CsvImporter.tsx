"use client";

import { useState } from "react";
import type { ImportOutcome, ImportPlan } from "@/lib/admin/product-csv";
import { Card } from "./ui";
import { ConfirmButton, ErrorNote, useAction } from "./client-ui";
import { applyImportAction, planImportAction } from "@/app/admin/(panel)/products/actions";

const ACTION_BADGE: Record<string, string> = {
  create: "a-badge-ok",
  update: "a-badge-info",
  skip: "a-badge-neutral",
  error: "a-badge-danger",
};

/**
 * Dry run first, always. The plan shows exactly what each row will do and the
 * apply button stays disabled until the whole file is clean, so a bad import
 * can never be half-applied.
 */
export function CsvImporter() {
  const { pending, error, runAction, setError } = useAction();
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPlan(null);
    setOutcome(null);
    if (file.size > 4_000_000) {
      setError("That file is larger than 4 MB. Split it into smaller batches.");
      return;
    }
    const text = await file.text();
    setCsv(text);
    setFilename(file.name);
    runAction(() => planImportAction(text), { refresh: false, onDone: (result) => setPlan(result) });
  }

  const rows = plan?.rows ?? [];
  const problems = rows.filter((r) => r.action === "error");
  const visible = showAll ? rows : problems.length ? problems.slice(0, 50) : rows.slice(0, 25);

  return (
    <Card title="Import">
      <div className="space-y-3 p-3">
        <ErrorNote message={error} />

        <div>
          <label htmlFor="csv-file" className="a-label">
            CSV file
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="a-input"
            onChange={(e) => pick(e.target.files?.[0])}
            disabled={pending}
          />
          <p className="a-hint">
            Nothing is written until you press Apply. {filename ? `Loaded ${filename}.` : ""}
          </p>
        </div>

        {outcome ? (
          <div className="rounded border border-[var(--a-border)] bg-[var(--a-ok-bg)] px-2.5 py-2 text-[12.5px] text-[var(--a-ok)]">
            Imported: {outcome.productsCreated} products created, {outcome.productsUpdated} updated,{" "}
            {outcome.variantsCreated} variants created, {outcome.variantsUpdated} updated.
          </div>
        ) : null}

        {plan ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="a-badge a-badge-ok">{plan.created} to create</span>
              <span className="a-badge a-badge-info">{plan.updated} to update</span>
              {plan.errors ? <span className="a-badge a-badge-danger">{plan.errors} errors</span> : null}
              <span className="ml-auto text-[12px] text-[var(--a-soft)]">
                {plan.ok ? "The file is clean and ready to apply." : "Fix every error and re-upload. Nothing was written."}
              </span>
            </div>

            <div className="a-scroll max-h-96 overflow-y-auto rounded border border-[var(--a-border)]">
              <table className="a-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Line</th>
                    <th>Handle</th>
                    <th>SKU</th>
                    <th style={{ width: 80 }}>Action</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, i) => (
                    <tr key={`${row.line}-${i}`}>
                      <td className="a-num">{row.line || "—"}</td>
                      <td className="a-mono">{row.handle || "—"}</td>
                      <td className="a-mono">{row.sku || "—"}</td>
                      <td>
                        <span className={`a-badge ${ACTION_BADGE[row.action]}`}>{row.action}</span>
                      </td>
                      <td>{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > visible.length ? (
              <button type="button" className="a-btn-link" onClick={() => setShowAll(true)}>
                Show all {rows.length} rows
              </button>
            ) : null}

            <div className="flex items-center gap-2">
              <ConfirmButton
                className="a-btn a-btn-primary"
                confirmLabel={`Yes, import ${plan.created + plan.updated} rows`}
                disabled={pending || !plan.ok}
                onConfirm={() =>
                  runAction(() => applyImportAction(csv), {
                    success: "Import applied",
                    onDone: (result) => {
                      setOutcome(result);
                      setPlan(null);
                    },
                  })
                }
              >
                Apply import
              </ConfirmButton>
              <button
                type="button"
                className="a-btn"
                onClick={() => {
                  setPlan(null);
                  setCsv("");
                  setFilename("");
                }}
              >
                Discard
              </button>
            </div>
          </>
        ) : null}
      </div>
    </Card>
  );
}
