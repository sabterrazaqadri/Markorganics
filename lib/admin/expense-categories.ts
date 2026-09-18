import type { ExpenseCategory } from "@/lib/db/schema";

/**
 * Client-safe labels for expense categories.
 *
 * Kept out of lib/admin/expenses.ts because that module is server-only and
 * the expense panel is a client component.
 */
export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  ad_spend: "Ad spend",
  delivery: "Delivery / courier",
  other: "Other",
};

export interface ExpenseRow {
  id: string;
  category: ExpenseCategory;
  amountPaisa: number;
  occurredOn: string;
  note: string;
  userName: string | null;
  createdAt: string;
}
