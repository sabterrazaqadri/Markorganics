"use client";

import { useEffect } from "react";
import { useCart } from "@/store/cart";

/** Rehydrates the persisted cart after mount so server and client markup match. */
export function CartHydration() {
  useEffect(() => {
    void useCart.persist.rehydrate();
    useCart.getState().setHydrated(true);
  }, []);
  return null;
}
