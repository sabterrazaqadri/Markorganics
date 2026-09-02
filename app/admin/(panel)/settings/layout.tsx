import Link from "next/link";
import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { PageHeader } from "@/components/admin/ui";
import { SettingsTabs } from "@/components/admin/SettingsTabs";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireView("settings:read");

  const tabs = [
    { href: "/admin/settings", label: "Store" },
    { href: "/admin/settings/delivery", label: "Delivery" },
    { href: "/admin/settings/policies", label: "Policies" },
    { href: "/admin/settings/notifications", label: "Notifications" },
    { href: "/admin/settings/metafields", label: "Metafields" },
    ...(can(ctx.user.role, "staff:read") ? [{ href: "/admin/settings/staff", label: "Staff" }] : []),
    { href: "/admin/settings/danger", label: "Danger zone" },
  ];

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Store-wide configuration. Values here override the defaults in config/commerce.ts."
        actions={
          <Link href="/admin/account" className="a-btn a-btn-xs">
            My account
          </Link>
        }
      />
      <SettingsTabs tabs={tabs} />
      {children}
    </>
  );
}
