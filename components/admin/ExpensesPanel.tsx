"use client";

import { useState } from "react";
import type { ExpenseCategory } from "@/lib/db/schema";
import { EXPENSE_CATEGORY_LABEL, type ExpenseRow } from "@/lib/admin/expense-categories";
import { formatPKR } from "@/lib/money";
import { Card, DateCell, EmptyState } from "./ui";
import { ConfirmButton, ErrorNote, useAction } from "./client-ui";
import { addExpenseAction, deleteExpenseAction } from "@/app/admin/(panel)/analytics/actions";

const CATEGORIES: ExpenseCategory[] = ["ad_spend", "delivery", "other"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Ad spend and courier cost have no automated source in this app yet, so
 * they're typed in here, one entry at a time. The analytics report sums
 * whatever falls inside the selected date range into the Net Profit line.
 */
export function ExpensesPanel({ rows, canWrite }: { rows: ExpenseRow[]; canWrite: boolean }) {
  const { pending, error, runAction } = useAction();
  const [category, setCategory] = useState<ExpenseCategory>("ad_spend");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [note, setNote] = useState("");

  function add() {
    runAction(
      () => addExpenseAction({ category, amountRupees: amount, occurredOn, note }),
      {
        success: "Expense added",
        onDone: () => {
          setAmount("");
          setNote("");
        },
      },
    );
  }

  return (
    <Card title="Expenses (ad spend, delivery, other)">
      <div className="p-3">
        <ErrorNote message={error} />
        {canWrite ? (
          <div className="mb-3 grid gap-2 sm:grid-cols-5">
            <div>
              <label htmlFor="exp-category" className="a-label">
                Category
              </label>
              <select
                id="exp-category"
                className="a-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="exp-amount" className="a-label">
                Amount (Rs)
              </label>
              <input
                id="exp-amount"
                className="a-input"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="exp-date" className="a-label">
                Date
              </label>
              <input
                id="exp-date"
                className="a-input"
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="exp-note" className="a-label">
                Note
              </label>
              <div className="flex gap-2">
                <input
                  id="exp-note"
                  className="a-input"
                  placeholder="e.g. Meta ads, 12–18 Sep"
                  maxLength={200}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button type="button" className="a-btn a-btn-primary shrink-0" disabled={pending || !amount} onClick={add}>
                  Add
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <EmptyState title="No expenses logged in this period">
            Ad spend and delivery cost stay out of Net Profit until they&apos;re added here.
          </EmptyState>
        ) : (
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th className="a-num">Amount</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <DateCell value={r.occurredOn} />
                    </td>
                    <td>{EXPENSE_CATEGORY_LABEL[r.category]}</td>
                    <td className="a-num">{formatPKR(r.amountPaisa)}</td>
                    <td className="max-w-[260px] truncate text-[var(--a-soft)]">{r.note || "—"}</td>
                    <td>
                      {canWrite ? (
                        <ConfirmButton
                          className="a-btn-link text-[var(--a-danger)]"
                          confirmLabel="Yes, delete"
                          disabled={pending}
                          onConfirm={() => runAction(() => deleteExpenseAction(r.id), { success: "Deleted" })}
                        >
                          Delete
                        </ConfirmButton>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
