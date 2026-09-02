"use client";

export function PrintButton({ count }: { count: number }) {
  return (
    <div className="p-noprint sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--a-border)] bg-white px-3 py-2">
      <p className="text-[12px] text-[var(--a-soft)]">
        {count} packing slip{count === 1 ? "" : "s"}, A5. Set your printer to A5 and margins to none.
      </p>
      <button type="button" className="a-btn a-btn-primary a-btn-xs" onClick={() => window.print()}>
        Print
      </button>
    </div>
  );
}
