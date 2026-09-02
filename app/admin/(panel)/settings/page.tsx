import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { getSettings } from "@/lib/settings";
import { StoreSettingsForm } from "@/components/admin/SettingsForms";

export const metadata = { title: "Store settings" };
export const dynamic = "force-dynamic";

export default async function StoreSettingsPage() {
  const ctx = await requireView("settings:read");
  const settings = await getSettings();
  return <StoreSettingsForm initial={settings.store} canWrite={can(ctx.user.role, "settings:write")} />;
}
