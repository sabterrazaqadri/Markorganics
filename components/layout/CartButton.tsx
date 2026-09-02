"use client";

import { useEffect, useState } from "react";
import { cartTotals, useCart } from "@/store/cart";

export function CartButton() {
  const items = useCart((s) => s.items);
  const open = useCart((s) => s.open);
  const { count } = cartTotals(items);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (count === 0) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 350);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <button
      type="button"
      onClick={open}
      className="btn btn-sm btn-primary relative"
      aria-label={count ? `Open cart, ${count} item${count === 1 ? "" : "s"}` : "Open cart, empty"}
      aria-haspopup="dialog"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 4h2l2.4 11.2A2 2 0 0 0 9.36 17H18a2 2 0 0 0 1.95-1.56L21.5 8H6.2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="20.5" r="1.3" fill="currentColor" />
        <circle cx="17.5" cy="20.5" r="1.3" fill="currentColor" />
      </svg>
      <span>Cart</span>
      <span
        className={`tabular inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold text-ink ${bump ? "anim-bump" : ""}`}
        aria-hidden="true"
      >
        {count}
      </span>
    </button>
  );
}
