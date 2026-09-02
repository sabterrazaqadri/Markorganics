"use client";

import { useEffect, useState, useTransition } from "react";
import { formatPKR } from "@/lib/money";
import { Modal } from "./client-ui";
import { searchVariants } from "@/app/admin/(panel)/variant-search";

export interface VariantOption {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  label: string;
  sku: string;
  pricePaisa: number;
  stock: number;
}

/** Shared line-item picker for order editing and draft orders. */
export function VariantPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (option: VariantOption) => void;
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<VariantOption[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      start(async () => setRows(await searchVariants(query)));
    }, 150);
    return () => clearTimeout(timer);
  }, [query, open]);

  return (
    <Modal open={open} onClose={onClose} title="Add a line" width={640}>
      <label htmlFor="variant-search" className="a-label">
        Search products
      </label>
      <input
        id="variant-search"
        className="a-input"
        autoFocus
        value={query}
        placeholder="Name or SKU"
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="a-scroll mt-2 max-h-72 overflow-y-auto">
        <table className="a-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th className="a-num">Stock</th>
              <th className="a-num">Price</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-[var(--a-soft)]">
                  {pending ? "Searching…" : "No products matched."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.variantId}>
                  <td>
                    {row.productName} <span className="text-[var(--a-soft)]">{row.label}</span>
                  </td>
                  <td className="a-mono text-[var(--a-soft)]">{row.sku}</td>
                  <td className={`a-num ${row.stock === 0 ? "text-[var(--a-danger)]" : ""}`}>{row.stock}</td>
                  <td className="a-num">{formatPKR(row.pricePaisa)}</td>
                  <td>
                    <button type="button" className="a-btn a-btn-xs" onClick={() => onPick(row)}>
                      Add
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
