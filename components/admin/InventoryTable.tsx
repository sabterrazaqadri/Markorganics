"use client";

import Link from "next/link";
import { useOptimistic, useState } from "react";
import type { InventoryRow } from "@/lib/admin/inventory";
import { MANUAL_REASONS, REASON_LABEL } from "@/lib/admin/inventory-reasons";
import type { InventoryReason } from "@/lib/db/schema";
import { FamilyDot } from "./ui";
import { ErrorNote, Modal, useAction } from "./client-ui";
import { adjustStockAction, setLowStockAction } from "@/app/admin/(panel)/products/actions";

export function InventoryTable({ rows, canWrite }: { rows: InventoryRow[]; canWrite: boolean }) {
  const { pending, error, runAction } = useAction();
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [stock, setStock] = useState("0");
  const [reason, setReason] = useState<InventoryReason>("recount");
  const [note, setNote] = useState("");

  // Optimistic stock so the number moves the instant the modal closes.
  const [stocks, patchStock] = useOptimistic(
    Object.fromEntries(rows.map((r) => [r.variantId, r.stock])) as Record<string, number>,
    (state, patch: { id: string; stock: number }) => ({ ...state, [patch.id]: patch.stock }),
  );

  function open(row: InventoryRow) {
    setEditing(row);
    setStock(String(stocks[row.variantId] ?? row.stock));
    setReason("recount");
    setNote("");
  }

  function save() {
    if (!editing) return;
    const next = Number(stock);
    runAction(
      async () => {
        patchStock({ id: editing.variantId, stock: next });
        return adjustStockAction({ variantId: editing.variantId, stock: next, reason, note });
      },
      { success: "Stock updated", onDone: () => setEditing(null) },
    );
  }

  return (
    <>
      <ErrorNote message={error} />

      <div className="a-card a-scroll">
        <table className="a-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th>SKU</th>
              <th className="a-num">Available</th>
              <th className="a-num">Committed</th>
              <th className="a-num">On hand</th>
              <th className="a-num">Low at</th>
              <th style={{ width: 130 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const available = stocks[row.variantId] ?? row.stock;
              const low = available <= row.lowStockThreshold;
              return (
                <tr key={row.variantId}>
                  <td>
                    <span className="flex items-center gap-2">
                      <FamilyDot family={row.family} />
                      <Link
                        href={`/admin/products/${row.productId}`}
                        prefetch={false}
                        className="max-w-[220px] truncate text-[var(--a-info)] hover:underline"
                      >
                        {row.productName}
                      </Link>
                    </span>
                  </td>
                  <td>{row.label}</td>
                  <td className="a-mono text-[var(--a-soft)]">{row.sku}</td>
                  <td className={`a-num font-semibold ${available === 0 ? "text-[var(--a-danger)]" : low ? "text-[var(--a-warn)]" : ""}`}>
                    {available}
                  </td>
                  <td className="a-num text-[var(--a-soft)]">{row.committed}</td>
                  <td className="a-num">{available + row.committed}</td>
                  <td className="a-num">
                    {canWrite ? (
                      <input
                        className="a-input a-input-xs w-16 text-right"
                        type="number"
                        min={0}
                        defaultValue={row.lowStockThreshold}
                        aria-label={`Low stock threshold for ${row.sku}`}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (value !== row.lowStockThreshold) {
                            runAction(() => setLowStockAction(row.variantId, value), { success: "Threshold saved" });
                          }
                        }}
                      />
                    ) : (
                      row.lowStockThreshold
                    )}
                  </td>
                  <td>
                    <span className="flex items-center gap-2">
                      {canWrite ? (
                        <button type="button" className="a-btn-link" onClick={() => open(row)}>
                          Adjust
                        </button>
                      ) : null}
                      <Link href={`/admin/inventory/${row.variantId}`} prefetch={false} className="a-btn-link">
                        History
                      </Link>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Adjust stock" width={420}>
        {editing ? (
          <>
            <ErrorNote message={error} />
            <p className="mb-2 text-[12px] text-[var(--a-soft)]">
              {editing.productName} · {editing.label} · <span className="a-mono">{editing.sku}</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="adj-stock" className="a-label">
                  New available stock
                </label>
                <input
                  id="adj-stock"
                  className="a-input"
                  type="number"
                  min={0}
                  autoFocus
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
                <p className="a-hint">Was {stocks[editing.variantId] ?? editing.stock}.</p>
              </div>
              <div>
                <label htmlFor="adj-reason" className="a-label">
                  Reason
                </label>
                <select id="adj-reason" className="a-select" value={reason} onChange={(e) => setReason(e.target.value as InventoryReason)}>
                  {MANUAL_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {REASON_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label htmlFor="adj-note" className="a-label mt-2">
              Note
            </label>
            <input id="adj-note" className="a-input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="a-btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" className="a-btn a-btn-primary" onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save adjustment"}
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}
