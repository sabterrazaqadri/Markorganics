"use client";

import { useState } from "react";
import { formatPKR } from "@/lib/money";
import type { CartQuote } from "@/app/(store)/checkout/actions";

/**
 * Discount code entry.
 *
 * The field only ever sends a code. The saving shown here comes back from the
 * server, and the order transaction recalculates it once more before the order
 * is written, so nothing typed in the browser can change what is charged.
 */
export function DiscountField({
  code,
  onApply,
  quote,
  loading,
}: {
  code: string;
  onApply: (code: string) => void;
  quote: CartQuote | null;
  loading: boolean;
}) {
  const [draft, setDraft] = useState(code);
  const applied = quote?.discount && !quote.discount.automatic ? quote.discount : null;
  const error = quote?.discountError ?? null;

  if (applied) {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded border border-band-care/40 bg-white px-3 py-2 text-sm">
        <span>
          <strong className="text-band-care">{applied.code}</strong> applied
          <span className="block text-xs text-ink-soft">{applied.title}</span>
        </span>
        <button
          type="button"
          className="text-sm underline underline-offset-4"
          onClick={() => {
            setDraft("");
            onApply("");
          }}
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <label htmlFor="discount-code" className="label text-sm">
        Discount code
      </label>
      <div className="flex gap-2">
        <input
          id="discount-code"
          name="discountCode"
          className="field"
          value={draft}
          maxLength={40}
          autoCapitalize="characters"
          placeholder="Enter a code"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "discount-error" : undefined}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onApply(draft.trim());
            }
          }}
        />
        <button type="button" className="btn btn-secondary" disabled={loading || !draft.trim()} onClick={() => onApply(draft.trim())}>
          {loading ? "Checking" : "Apply"}
        </button>
      </div>
      {error ? (
        <p id="discount-error" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {quote?.discount?.automatic ? (
        <p className="mt-1 text-xs text-band-care">
          {quote.discount.title} is already applied automatically, saving {formatPKR(quote.discountPaisa)}.
        </p>
      ) : null}
    </div>
  );
}
