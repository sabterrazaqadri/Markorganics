import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/session";
import { can, canAny, ROLE_LABEL, type Permission } from "@/lib/admin/permissions";
import { AdminNav, type NavGroup } from "@/components/admin/Nav";
import { GlobalSearch } from "@/components/admin/GlobalSearch";
import { orderViewCounts } from "@/lib/queries/orders";
import { abandonedCounts } from "@/lib/admin/abandoned";
import { countLowStock } from "@/lib/admin/inventory";
import { deadJobCount } from "@/lib/integrations/health";
import { unreadInboundCount } from "@/lib/whatsapp/client";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

interface Entry {
  href: string;
  label: string;
  need: Permission[];
  count?: number;
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  const role = ctx.user.role;

  const [orders, abandoned, lowStock, deadJobs, unreadWhatsapp] = await Promise.all([
    can(role, "orders:read") ? orderViewCounts() : Promise.resolve({} as Record<string, number>),
    can(role, "abandoned:read") ? abandonedCounts() : Promise.resolve({ open: 0, recovered: 0, dismissed: 0, valuePaisa: 0 }),
    can(role, "inventory:read") ? countLowStock() : Promise.resolve(0),
    can(role, "jobs:read") ? deadJobCount() : Promise.resolve(0),
    can(role, "customers:read") ? unreadInboundCount() : Promise.resolve(0),
  ]);

  const structure: { title: string; entries: Entry[] }[] = [
    {
      title: "Overview",
      entries: [{ href: "/admin", label: "Dashboard", need: ["orders:read"] }],
    },
    {
      title: "Selling",
      entries: [
        { href: "/admin/orders", label: "Orders", need: ["orders:read"], count: orders.unfulfilled },
        { href: "/admin/drafts", label: "Draft orders", need: ["drafts:read"] },
        { href: "/admin/abandoned", label: "Abandoned checkouts", need: ["abandoned:read"], count: abandoned.open },
        { href: "/admin/customers", label: "Customers", need: ["customers:read"], count: unreadWhatsapp },
        { href: "/admin/segments", label: "Segments", need: ["customers:read"] },
        { href: "/admin/discounts", label: "Discounts", need: ["discounts:read"] },
      ],
    },
    {
      title: "Catalogue",
      entries: [
        { href: "/admin/products", label: "Products", need: ["products:read"] },
        { href: "/admin/collections", label: "Collections", need: ["collections:read"] },
        { href: "/admin/inventory", label: "Inventory", need: ["inventory:read"], count: lowStock },
        { href: "/admin/files", label: "Files", need: ["files:read"] },
      ],
    },
    {
      title: "Content",
      entries: [
        { href: "/admin/content/pages", label: "Pages", need: ["content:read"] },
        { href: "/admin/content/blog", label: "Blog", need: ["content:read"] },
        { href: "/admin/content/menus", label: "Navigation", need: ["content:read"] },
      ],
    },
    {
      title: "Insights",
      entries: [
        { href: "/admin/analytics", label: "Analytics", need: ["analytics:read"] },
        { href: "/admin/activity", label: "Activity log", need: ["activity:read"] },
      ],
    },
    {
      title: "Store",
      entries: [
        { href: "/admin/settings", label: "Settings", need: ["settings:read"] },
        { href: "/admin/integrations", label: "Integrations", need: ["integrations:read"] },
        { href: "/admin/jobs", label: "Jobs", need: ["jobs:read"], count: deadJobs },
        { href: "/admin/settings/staff", label: "Staff", need: ["staff:read"] },
      ],
    },
  ];

  const groups: NavGroup[] = structure
    .map((group) => ({
      title: group.title,
      items: group.entries.filter((e) => canAny(role, e.need)).map(({ href, label, count }) => ({ href, label, count })),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[95] focus:rounded focus:bg-[var(--a-accent)] focus:px-3 focus:py-1.5 focus:text-white"
      >
        Skip to content
      </a>

      <aside className="a-side md:sticky md:top-0 md:h-dvh md:w-52 md:shrink-0 md:overflow-y-auto">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:block">
          <Link href="/admin" className="block text-[13px] font-bold tracking-tight text-white">
            MARK <span className="font-normal text-[#9aa0a6]">admin</span>
          </Link>
          <p className="mt-0.5 hidden text-[11px] text-[#8b9096] md:block">
            {ctx.user.name} &middot; {ROLE_LABEL[role]}
          </p>
        </div>
        <AdminNav groups={groups} />
        <div className="mt-2 border-t border-[#33373c] px-3 py-2">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="block py-1 text-[11.5px] text-[#9aa0a6] hover:text-white"
          >
            View store &nearr;
          </a>
          <Link href="/admin/account" className="block py-1 text-[11.5px] text-[#9aa0a6] hover:text-white">
            My account
          </Link>
          <form action={logout}>
            <button type="submit" className="py-1 text-[11.5px] text-[#9aa0a6] hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--a-border)] bg-[var(--a-surface)] px-3 py-2">
          <GlobalSearch />
          <div className="flex items-center gap-2 text-[11.5px] text-[var(--a-soft)]">
            <span className="hidden sm:inline">{ctx.user.email}</span>
          </div>
        </header>
        <main id="admin-main" className="min-w-0 flex-1 p-3 md:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
