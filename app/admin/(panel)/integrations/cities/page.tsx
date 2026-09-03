import { requireView } from "@/lib/admin/session";
import { can } from "@/lib/admin/permissions";
import { buildCityMap } from "@/lib/courier/cities";
import { COURIER_ADAPTERS, getCourier } from "@/lib/courier";
import { getIntegrationSettings } from "@/lib/settings";
import { CityMapper } from "@/components/admin/CityMapper";

export const metadata = { title: "City mapping" };
export const dynamic = "force-dynamic";

export default async function CityMappingPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const ctx = await requireView("integrations:read");
  const params = await searchParams;
  const settings = await getIntegrationSettings();

  const provider =
    params.provider && getCourier(params.provider) ? params.provider : getCourier(settings.defaultCourier) ? settings.defaultCourier : "postex";

  const { rows, courierCities, error } = await buildCityMap(provider);

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[var(--a-soft)]">
        Every courier names cities differently, and a wrong id is the most common reason a booking fails. Thirty
        minutes here, done once, prevents most of them.
      </p>
      <CityMapper
        provider={provider}
        providers={Object.values(COURIER_ADAPTERS).map((a) => ({ id: a.id, name: a.verified ? a.name : `${a.name} (unverified)` }))}
        rows={rows.map((row) => ({
          markCity: row.markCity,
          orderCount: row.orderCount,
          mapping: row.mapping
            ? {
                courierCityId: row.mapping.courierCityId,
                courierCityName: row.mapping.courierCityName,
                confirmedAt: row.mapping.confirmedAt?.toISOString() ?? null,
              }
            : null,
          suggestion: row.suggestion,
        }))}
        courierCities={courierCities}
        loadError={error}
        canWrite={can(ctx.user.role, "integrations:write")}
      />
    </div>
  );
}
