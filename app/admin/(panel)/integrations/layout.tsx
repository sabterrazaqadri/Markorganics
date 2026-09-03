import { requireView } from "@/lib/admin/session";
import { PageHeader } from "@/components/admin/ui";
import { SettingsTabs } from "@/components/admin/SettingsTabs";

export const dynamic = "force-dynamic";

export default async function IntegrationsLayout({ children }: { children: React.ReactNode }) {
  await requireView("integrations:read");

  const tabs = [
    { href: "/admin/integrations", label: "Providers" },
    { href: "/admin/integrations/cities", label: "City mapping" },
    { href: "/admin/integrations/whatsapp", label: "WhatsApp" },
    { href: "/admin/integrations/cod", label: "COD reconciliation" },
    { href: "/admin/integrations/log", label: "Call log" },
  ];

  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="Couriers, WhatsApp and the three ad platforms. Everything is off until it is switched on, and dry-run means nothing leaves the building."
      />
      <SettingsTabs tabs={tabs} />
      {children}
    </>
  );
}
