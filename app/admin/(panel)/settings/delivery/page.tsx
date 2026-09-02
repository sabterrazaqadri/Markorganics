import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { getSettings } from "@/lib/settings";
import { DeliverySettingsForm } from "@/components/admin/SettingsForms";

export const metadata = { title: "Delivery settings" };
export const dynamic = "force-dynamic";

export default async function DeliverySettingsPage() {
  const ctx = await requireView("settings:read");
  const settings = await getSettings();
  return <DeliverySettingsForm initial={settings.delivery} canWrite={can(ctx.user.role, "settings:write")} />;
}
