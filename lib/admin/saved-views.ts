import "server-only";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { savedViews, type SavedView } from "@/lib/db/schema";

/** A user sees their own saved views plus any shared ones (userId null). */
export async function listSavedViews(resource: string, userId: string): Promise<SavedView[]> {
  return db
    .select()
    .from(savedViews)
    .where(
      and(eq(savedViews.resource, resource), or(eq(savedViews.userId, userId), isNull(savedViews.userId))!),
    )
    .orderBy(asc(savedViews.position), asc(savedViews.name));
}

export async function createSavedView(input: {
  resource: string;
  name: string;
  query: string;
  userId: string;
}): Promise<SavedView> {
  const [row] = await db.insert(savedViews).values(input).returning();
  return row;
}

export async function deleteSavedView(id: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(savedViews)
    .where(and(eq(savedViews.id, id), eq(savedViews.userId, userId)))
    .returning({ id: savedViews.id });
  return rows.length > 0;
}
