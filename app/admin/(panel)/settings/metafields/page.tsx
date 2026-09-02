import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { listMetafieldDefinitions } from "@/lib/queries/products-admin";
import { MetafieldSettings } from "@/components/admin/MetafieldSettings";

export const metadata = { title: "Metafields" };
export const dynamic = "force-dynamic";

export default async function MetafieldsPage() {
  const ctx = await requireView("settings:read");
  const rows = await listMetafieldDefinitions();

  return (
    <MetafieldSettings
      canWrite={can(ctx.user.role, "settings:write")}
      rows={rows.map((r) => ({ id: r.id, key: r.key, name: r.name, type: r.type, description: r.description }))}
    />
  );
}
