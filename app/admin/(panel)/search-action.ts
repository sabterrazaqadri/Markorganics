"use server";

import { requirePermission } from "@/lib/admin/session";
import { globalSearch, type SearchHit } from "@/lib/admin/search";

/** Everyone with order access can search; results are already role-safe. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  await requirePermission("orders:read");
  return globalSearch(query);
}
