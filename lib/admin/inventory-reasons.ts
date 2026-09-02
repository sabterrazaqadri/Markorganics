import type { InventoryReason } from "@/lib/db/schema";

/**
 * Client-safe labels for the inventory ledger.
 *
 * Kept out of lib/admin/inventory.ts because that module is server-only and
 * the stock editor is a client component.
 */
export const REASON_LABEL: Record<InventoryReason, string> = {
  recount: "Recount",
  damaged: "Damaged",
  received: "Received",
  correction: "Correction",
  theft: "Theft",
  sale: "Sale",
  restock: "Restock",
  order_edit: "Order edit",
};

/** Reasons a human picks in the inline stock editor. */
export const MANUAL_REASONS: InventoryReason[] = ["recount", "damaged", "received", "correction", "theft"];
