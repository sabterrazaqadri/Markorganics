"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_QTY_PER_LINE, deliveryFeeFor } from "@/config/commerce";

export interface CartItem {
  variantId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  sku: string;
  unitPricePaisa: number;
  image: string;
  quantity: number;
  /** Stock seen when the item was added. The server re-checks at checkout. */
  maxQty: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  hydrated: boolean;
  /** Only the code is kept; the amount always comes from the server. */
  discountCode: string;
  /** Stable per-browser key so an abandoned checkout updates one row. */
  sessionKey: string;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  setHydrated: (v: boolean) => void;
  setDiscountCode: (code: string) => void;
}

function makeSessionKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function clampQty(q: number, max: number) {
  return Math.max(1, Math.min(q, MAX_QTY_PER_LINE, Math.max(1, max)));
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      hydrated: false,
      discountCode: "",
      sessionKey: makeSessionKey(),
      add: (item, quantity = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.variantId === item.variantId);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, ...item, quantity: clampQty(i.quantity + quantity, item.maxQty) }
                  : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, quantity: clampQty(quantity, item.maxQty) }] };
        }),
      setQuantity: (variantId, quantity) =>
        set((s) => ({
          items:
            quantity <= 0
              ? s.items.filter((i) => i.variantId !== variantId)
              : s.items.map((i) => (i.variantId === variantId ? { ...i, quantity: clampQty(quantity, i.maxQty) } : i)),
        })),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [], discountCode: "" }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      setHydrated: (v) => set({ hydrated: v }),
      setDiscountCode: (discountCode) => set({ discountCode }),
    }),
    {
      name: "mrk-cart-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items, discountCode: s.discountCode, sessionKey: s.sessionKey }),
      skipHydration: true,
    },
  ),
);

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.unitPricePaisa * i.quantity, 0);
}

/**
 * A local estimate only, using the fallback rates from config/commerce.ts.
 * Real delivery pricing and discounts live in the database — see useCartQuote.
 */
export function cartTotals(items: CartItem[]) {
  const subtotal = cartSubtotal(items);
  const delivery = deliveryFeeFor(subtotal);
  return { subtotal, delivery, total: subtotal + delivery, count: items.reduce((n, i) => n + i.quantity, 0) };
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}
