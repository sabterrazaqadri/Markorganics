"use client";

import Link from "next/link";
import { useMemo, useOptimistic } from "react";
import type { AdminProductRow } from "@/lib/queries/products-admin";
import type { ProductStatus } from "@/lib/db/schema";
import { formatPKR } from "@/lib/money";
import { FamilyDot, ProductStatusPill, PRODUCT_STATUS_LABEL } from "./ui";
import { ConfirmButton, ErrorNote, useAction, useRowSelection } from "./client-ui";
import { deleteProductAction, setProductStatusAction } from "@/app/admin/(panel)/products/actions";

export function ProductsTable({ rows, canWrite }: { rows: AdminProductRow[]; canWrite: boolean }) {
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const selection = useRowSelection(ids);
  const { pending, error, runAction } = useAction();

  // Optimistic status flip so the pill responds before the round trip lands.
  const [statuses, setStatus] = useOptimistic(
    Object.fromEntries(rows.map((r) => [r.id, r.status])) as Record<string, ProductStatus>,
    (state, patch: { id: string; status: ProductStatus }) => ({ ...state, [patch.id]: patch.status }),
  );

  return (
    <>
      <ErrorNote message={error} />

      {canWrite && selection.count > 0 ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded border border-[var(--a-border)] bg-[var(--a-info-bg)] px-2.5 py-1.5">
          <strong className="text-[12px]">{selection.count} selected</strong>
          <Link href={`/admin/products/bulk?ids=${selection.ids.join(",")}`} className="a-btn a-btn-xs">
            Bulk edit these
          </Link>
          <button type="button" className="a-btn-link ml-auto" onClick={selection.clear}>
            Clear
          </button>
        </div>
      ) : null}

      <div className="a-card a-scroll">
        <table className="a-table">
          <thead>
            <tr>
              {canWrite ? (
                <th style={{ width: 30 }}>
                  <input type="checkbox" aria-label="Select all products" checked={selection.allSelected} onChange={selection.toggleAll} />
                </th>
              ) : null}
              <th>Product</th>
              <th>Status</th>
              <th>Type / vendor</th>
              <th>Tags</th>
              <th>Variants</th>
              <th className="a-num">Stock</th>
              <th className="a-num">From</th>
              {canWrite ? <th style={{ width: 150 }}>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const status = statuses[p.id] ?? p.status;
              const lowest = p.variants.some((v) => v.stock <= v.lowStockThreshold);
              return (
                <tr key={p.id} data-selected={selection.isSelected(p.id) || undefined}>
                  {canWrite ? (
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${p.name}`}
                        checked={selection.isSelected(p.id)}
                        onChange={() => selection.toggle(p.id)}
                      />
                    </td>
                  ) : null}
                  <td>
                    <span className="flex items-center gap-2">
                      <FamilyDot family={p.family} />
                      <span className="min-w-0">
                        <Link
                          href={`/admin/products/${p.id}`}
                          prefetch={false}
                          className="block max-w-[240px] truncate font-medium text-[var(--a-info)] hover:underline"
                        >
                          {p.name}
                        </Link>
                        <span className="block text-[11px] text-[var(--a-soft)]">/{p.slug}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <ProductStatusPill status={status} />
                  </td>
                  <td className="max-w-[140px] truncate text-[var(--a-soft)]">
                    {p.productType || "—"}
                    {p.vendor ? <span className="block text-[11px]">{p.vendor}</span> : null}
                  </td>
                  <td>
                    <span className="flex flex-wrap gap-1">
                      {p.tags.slice(0, 3).map((t) => (
                        <span key={t} className="a-tag">
                          {t}
                        </span>
                      ))}
                      {p.tags.length > 3 ? <span className="text-[11px] text-[var(--a-soft)]">+{p.tags.length - 3}</span> : null}
                    </span>
                  </td>
                  <td className="text-[11.5px] text-[var(--a-soft)]">
                    {p.variants.length === 0
                      ? "none"
                      : p.variants.map((v) => v.label).slice(0, 3).join(", ") + (p.variants.length > 3 ? "…" : "")}
                  </td>
                  <td className={`a-num ${lowest ? "font-semibold text-[var(--a-warn)]" : ""}`}>{p.totalStock}</td>
                  <td className="a-num">{p.minPricePaisa ? formatPKR(p.minPricePaisa) : "—"}</td>
                  {canWrite ? (
                    <td>
                      <span className="flex items-center gap-2">
                        <Link href={`/admin/products/${p.id}`} prefetch={false} className="a-btn-link">
                          Edit
                        </Link>
                        {status === "archived" ? (
                          <button
                            type="button"
                            className="a-btn-link"
                            disabled={pending}
                            onClick={() =>
                              runAction(
                                async () => {
                                  setStatus({ id: p.id, status: "active" });
                                  return setProductStatusAction(p.id, "active");
                                },
                                { success: "Product restored" },
                              )
                            }
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="a-btn-link"
                            disabled={pending}
                            onClick={() =>
                              runAction(
                                async () => {
                                  setStatus({ id: p.id, status: "archived" });
                                  return setProductStatusAction(p.id, "archived");
                                },
                                { success: "Product archived" },
                              )
                            }
                          >
                            Archive
                          </button>
                        )}
                        <ConfirmButton
                          className="a-btn-link text-[var(--a-danger)]"
                          confirmLabel="Sure?"
                          disabled={pending}
                          onConfirm={() => runAction(() => deleteProductAction(p.id), { success: "Product deleted" })}
                        >
                          Delete
                        </ConfirmButton>
                      </span>
                      <span className="sr-only">
                        {p.name} is {PRODUCT_STATUS_LABEL[status]}
                      </span>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
