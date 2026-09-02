import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { ROLE_BLURB } from "@/lib/admin/permissions";
import { Card, PageHeader, RolePill } from "@/components/admin/ui";

export const metadata = { title: "No access" };
export const dynamic = "force-dynamic";

/** Where requireView() sends someone whose role does not cover a page. */
export default async function NoAccessPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const ctx = await requireAdmin();
  const { p } = await searchParams;

  return (
    <>
      <PageHeader title="You do not have access to that screen" actions={<RolePill role={ctx.user.role} />} />
      <Card>
        <div className="space-y-2 p-3 text-[12.5px]">
          <p>
            Your role is <strong>{ctx.user.role}</strong>: {ROLE_BLURB[ctx.user.role]}
          </p>
          {p ? (
            <p className="text-[var(--a-soft)]">
              That page needs the <code className="a-mono">{p}</code> permission.
            </p>
          ) : null}
          <p className="text-[var(--a-soft)]">
            Ask an Owner to change your role if you need it. The same check runs on every action, so nothing was changed.
          </p>
          <div className="flex gap-2 pt-1">
            <Link href="/admin" className="a-btn a-btn-primary a-btn-xs">
              Back to the dashboard
            </Link>
            <Link href="/admin/orders" className="a-btn a-btn-xs">
              Orders
            </Link>
          </div>
        </div>
      </Card>
    </>
  );
}
