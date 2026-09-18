import "server-only";
import { desc, eq, gte, lte, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenseEntries, users, type ExpenseCategory } from "@/lib/db/schema";
import type { ExpenseRow } from "./expense-categories";

export type { ExpenseRow } from "./expense-categories";

export interface ExpenseFilter {
  from?: Date;
  to?: Date;
}

export async function listExpenses(filter: ExpenseFilter = {}): Promise<ExpenseRow[]> {
  const conds = [];
  if (filter.from) conds.push(gte(expenseEntries.occurredOn, filter.from));
  if (filter.to) conds.push(lte(expenseEntries.occurredOn, filter.to));

  const rows = await db
    .select({
      id: expenseEntries.id,
      category: expenseEntries.category,
      amountPaisa: expenseEntries.amountPaisa,
      occurredOn: expenseEntries.occurredOn,
      note: expenseEntries.note,
      userName: users.name,
      createdAt: expenseEntries.createdAt,
    })
    .from(expenseEntries)
    .leftJoin(users, eq(users.id, expenseEntries.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(expenseEntries.occurredOn), desc(expenseEntries.createdAt))
    .limit(200);

  return rows.map((r) => ({
    ...r,
    occurredOn: r.occurredOn.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createExpense(input: {
  category: ExpenseCategory;
  amountPaisa: number;
  occurredOn: Date;
  note?: string;
  userId?: string | null;
}): Promise<string> {
  const [row] = await db
    .insert(expenseEntries)
    .values({
      category: input.category,
      amountPaisa: input.amountPaisa,
      occurredOn: input.occurredOn,
      note: input.note ?? "",
      userId: input.userId ?? null,
    })
    .returning({ id: expenseEntries.id });
  return row.id;
}

export async function deleteExpense(id: string): Promise<void> {
  await db.delete(expenseEntries).where(eq(expenseEntries.id, id));
}
