import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { listInventory } from "@/lib/admin/inventory";
import { CursorPager, EmptyState, PageHeader } from "@/components/admin/ui";
import { InventoryTable } from "@/components/admin/InventoryTable";

export const metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "all", label: "All" },
  { key: "low", label: "Low stock" },
  { key: "out", label: "Out of stock" },
] as const;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; cursor?: string }>;
}) {
  const ctx = await requireView("inventory:read");
  const sp = await searchParams;
  const view = (VIEWS.find((v) => v.key === sp.view)?.key ?? "all") as "all" | "low" | "out";

  const { rows, nextCursor } = await listInventory({ q: sp.q, view, cursor: sp.cursor });

  const href = (key: string) => {
    const qs = new URLSearchParams();
    if (sp.q) qs.set("q", sp.q);
    if (key !== "all") qs.set("view", key);
    const q = qs.toString();
    return q ? `/admin/inventory?${q}` : "/admin/inventory";
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Available is what is free to sell. Committed is sitting in unfulfilled orders."
      />

      <nav aria-label="Inventory views" className="a-tabs mb-3">
        {VIEWS.map((v) => (
          <Link key={v.key} href={href(v.key)} className="a-tab" aria-current={view === v.key ? "page" : undefined}>
            {v.label}
          </Link>
        ))}
      </nav>

      <form method="get" className="a-card mb-3 flex flex-wrap items-end gap-2 p-2">
        {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
        <div className="min-w-[240px] flex-1">
          <label htmlFor="q" className="a-label">
            Search
          </label>
          <input id="q" name="q" className="a-input" defaultValue={sp.q ?? ""} placeholder="Product, SKU or size" />
        </div>
        <button type="submit" className="a-btn a-btn-primary">
          Search
        </button>
        <Link href="/admin/inventory" className="a-btn">
          Clear
        </Link>
      </form>

      {rows.length === 0 ? (
        <div className="a-card">
          <EmptyState title="Nothing to show">
            {view === "low"
              ? "Every variant is above its low-stock threshold."
              : view === "out"
                ? "Nothing is out of stock."
                : "Add a product with variants and it will appear here."}
          </EmptyState>
        </div>
      ) : (
        <InventoryTable rows={rows} canWrite={can(ctx.user.role, "inventory:write")} />
      )}

      <CursorPager
        basePath="/admin/inventory"
        params={{ q: sp.q, view: view === "all" ? undefined : view }}
        nextCursor={nextCursor}
        hasCursor={Boolean(sp.cursor)}
      />
    </>
  );
}
