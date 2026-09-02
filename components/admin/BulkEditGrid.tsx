"use client";

import { useState } from "react";
import type { ProductStatus } from "@/lib/db/schema";
import { PRODUCT_STATUSES } from "@/lib/db/schema";
import { FamilyDot, PRODUCT_STATUS_LABEL } from "./ui";
import { ErrorNote, useAction } from "./client-ui";
import { bulkEditAction } from "@/app/admin/(panel)/products/actions";

export interface BulkRow {
  productId: string;
  productName: string;
  productStatus: ProductStatus;
  productTags: string[];
  family: string;
  isFirstVariant: boolean;
  variantId: string;
  sku: string;
  label: string;
  priceRupees: string;
  compareAtRupees: string;
  stock: string;
  lowStockThreshold: string;
}

/**
 * An editable grid: type in the cells, then save every change at once.
 * Only cells that actually moved are sent, so nothing untouched is rewritten.
 */
export function BulkEditGrid({ rows }: { rows: BulkRow[] }) {
  const { pending, error, runAction } = useAction();
  const [draft, setDraft] = useState(rows);
  const [fill, setFill] = useState({ status: "", tag: "" });

  function patch(variantId: string, next: Partial<BulkRow>) {
    setDraft((prev) => prev.map((r) => (r.variantId === variantId ? { ...r, ...next } : r)));
  }
  function patchProduct(productId: string, next: Partial<BulkRow>) {
    setDraft((prev) => prev.map((r) => (r.productId === productId ? { ...r, ...next } : r)));
  }

  const changedVariants = draft.filter((d, i) => {
    const original = rows[i];
    return (
      d.priceRupees !== original.priceRupees ||
      d.compareAtRupees !== original.compareAtRupees ||
      d.stock !== original.stock ||
      d.lowStockThreshold !== original.lowStockThreshold
    );
  });

  const changedProducts = [
    ...new Map(
      draft
        .filter((d, i) => d.productStatus !== rows[i].productStatus || d.productTags.join(",") !== rows[i].productTags.join(","))
        .map((d) => [d.productId, d]),
    ).values(),
  ];

  const dirty = changedVariants.length + changedProducts.length;

  function save() {
    runAction(
      () =>
        bulkEditAction({
          rows: changedVariants.map((d) => ({
            variantId: d.variantId,
            priceRupees: d.priceRupees,
            compareAtRupees: d.compareAtRupees,
            stock: d.stock,
            lowStockThreshold: d.lowStockThreshold,
          })),
          productRows: changedProducts.map((d) => ({
            productId: d.productId,
            status: d.productStatus,
            tags: d.productTags.join(", "),
          })),
        }),
      { success: `${dirty} change${dirty === 1 ? "" : "s"} saved` },
    );
  }

  return (
    <>
      <ErrorNote message={error} />

      <div className="a-card mb-3 flex flex-wrap items-end gap-2 p-2">
        <div>
          <label htmlFor="fill-status" className="a-label">
            Set every status to
          </label>
          <select
            id="fill-status"
            className="a-select"
            value={fill.status}
            onChange={(e) => {
              const status = e.target.value as ProductStatus | "";
              setFill((f) => ({ ...f, status: e.target.value }));
              if (status) setDraft((prev) => prev.map((r) => ({ ...r, productStatus: status })));
            }}
          >
            <option value="">Choose…</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PRODUCT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fill-tag" className="a-label">
            Add a tag to every product
          </label>
          <div className="flex gap-1">
            <input id="fill-tag" className="a-input" value={fill.tag} onChange={(e) => setFill((f) => ({ ...f, tag: e.target.value }))} />
            <button
              type="button"
              className="a-btn"
              disabled={!fill.tag.trim()}
              onClick={() => {
                const tag = fill.tag.trim();
                setDraft((prev) =>
                  prev.map((r) =>
                    r.productTags.some((t) => t.toLowerCase() === tag.toLowerCase())
                      ? r
                      : { ...r, productTags: [...r.productTags, tag] },
                  ),
                );
                setFill((f) => ({ ...f, tag: "" }));
              }}
            >
              Apply
            </button>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-[var(--a-soft)]">
            {dirty === 0 ? "No changes yet" : `${dirty} unsaved change${dirty === 1 ? "" : "s"}`}
          </span>
          <button type="button" className="a-btn" disabled={dirty === 0} onClick={() => setDraft(rows)}>
            Reset
          </button>
          <button type="button" className="a-btn a-btn-primary" disabled={pending || dirty === 0} onClick={save}>
            {pending ? "Saving…" : "Save all changes"}
          </button>
        </div>
      </div>

      <div className="a-card a-scroll">
        <table className="a-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th>Status</th>
              <th>Tags</th>
              <th className="a-num" style={{ width: 100 }}>
                Price Rs
              </th>
              <th className="a-num" style={{ width: 110 }}>
                Compare at
              </th>
              <th className="a-num" style={{ width: 90 }}>
                Stock
              </th>
              <th className="a-num" style={{ width: 90 }}>
                Low at
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.map((row, i) => {
              const original = rows[i];
              const changed = (key: keyof BulkRow) => row[key] !== original[key];
              return (
                <tr key={row.variantId}>
                  <td>
                    {row.isFirstVariant ? (
                      <span className="flex items-center gap-2">
                        <FamilyDot family={row.family} />
                        <span className="max-w-[200px] truncate font-medium">{row.productName}</span>
                      </span>
                    ) : (
                      <span className="text-[var(--a-soft)]">&nbsp;</span>
                    )}
                  </td>
                  <td>
                    <span className="block">{row.label}</span>
                    <span className="a-mono text-[var(--a-soft)]">{row.sku}</span>
                  </td>
                  <td>
                    {row.isFirstVariant ? (
                      <select
                        className="a-select a-input-xs"
                        aria-label={`Status for ${row.productName}`}
                        value={row.productStatus}
                        onChange={(e) => patchProduct(row.productId, { productStatus: e.target.value as ProductStatus })}
                      >
                        {PRODUCT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {PRODUCT_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </td>
                  <td>
                    {row.isFirstVariant ? (
                      <input
                        className="a-input a-input-xs"
                        aria-label={`Tags for ${row.productName}`}
                        value={row.productTags.join(", ")}
                        onChange={(e) =>
                          patchProduct(row.productId, {
                            productTags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                          })
                        }
                      />
                    ) : null}
                  </td>
                  <td className="a-num">
                    <input
                      className={`a-input a-input-xs text-right ${changed("priceRupees") ? "border-[var(--a-focus)]" : ""}`}
                      type="number"
                      min={0}
                      step="0.01"
                      aria-label={`Price for ${row.sku}`}
                      value={row.priceRupees}
                      onChange={(e) => patch(row.variantId, { priceRupees: e.target.value })}
                    />
                  </td>
                  <td className="a-num">
                    <input
                      className={`a-input a-input-xs text-right ${changed("compareAtRupees") ? "border-[var(--a-focus)]" : ""}`}
                      type="number"
                      min={0}
                      step="0.01"
                      aria-label={`Compare-at price for ${row.sku}`}
                      value={row.compareAtRupees}
                      onChange={(e) => patch(row.variantId, { compareAtRupees: e.target.value })}
                    />
                  </td>
                  <td className="a-num">
                    <input
                      className={`a-input a-input-xs text-right ${changed("stock") ? "border-[var(--a-focus)]" : ""}`}
                      type="number"
                      min={0}
                      aria-label={`Stock for ${row.sku}`}
                      value={row.stock}
                      onChange={(e) => patch(row.variantId, { stock: e.target.value })}
                    />
                  </td>
                  <td className="a-num">
                    <input
                      className={`a-input a-input-xs text-right ${changed("lowStockThreshold") ? "border-[var(--a-focus)]" : ""}`}
                      type="number"
                      min={0}
                      aria-label={`Low stock threshold for ${row.sku}`}
                      value={row.lowStockThreshold}
                      onChange={(e) => patch(row.variantId, { lowStockThreshold: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="a-hint mt-2">Stock edits here are written to the inventory ledger as a Correction.</p>
    </>
  );
}
