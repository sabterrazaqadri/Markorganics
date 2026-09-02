import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { Card } from "@/components/admin/ui";

export const metadata = { title: "Danger zone" };
export const dynamic = "force-dynamic";

export default async function DangerZonePage() {
  const ctx = await requireView("settings:read");
  const owner = can(ctx.user.role, "settings:write");

  return (
    <div className="space-y-3">
      <Card title="Database backup">
        <div className="space-y-2 p-3">
          <p className="text-[12.5px]">
            Exports every table as one JSON file: products, variants, orders, customers, discounts, content, settings
            and the audit log. Password hashes are never included.
          </p>
          {owner ? (
            <a href="/api/admin/backup" className="a-btn a-btn-primary a-btn-xs" download>
              Download a full backup
            </a>
          ) : (
            <p className="a-hint">Only an Owner can export a backup.</p>
          )}
          <p className="a-hint">
            The file can be large on a busy store. Sessions and login attempts are left out on purpose.
          </p>
        </div>
      </Card>

      <Card title="What is never deleted">
        <ul className="space-y-1 p-3 text-[12.5px] text-[var(--a-soft)]">
          <li>
            Orders, products, customers, collections, discounts and content are <strong>soft deleted</strong>: they
            disappear from lists but stay in the database and in exports.
          </li>
          <li>
            Media files are the exception. Deleting one removes the row and, for uploads under{" "}
            <code className="a-mono">/uploads</code>, the file itself.
          </li>
          <li>Audit log entries are never removed, so a dispute can always be traced back.</li>
        </ul>
      </Card>
    </div>
  );
}
