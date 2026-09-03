"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { City } from "@/lib/courier/types";
import { Card } from "./ui";
import { ErrorNote, useAction } from "./client-ui";
import { deleteCityMappingAction, saveCityMappingAction } from "@/app/admin/(panel)/integrations/actions";

export interface CityMapRowView {
  markCity: string;
  orderCount: number;
  mapping: { courierCityId: string; courierCityName: string; confirmedAt: string | null } | null;
  suggestion: { id: string; name: string; score: number } | null;
}

/**
 * City mapping.
 *
 * Suggestions are offered, never applied: each row needs a click, because a
 * wrong city id does not fail loudly — it sends the parcel to the wrong depot
 * and nobody finds out for three days.
 */
export function CityMapper({
  provider,
  providers,
  rows,
  courierCities,
  loadError,
  canWrite,
}: {
  provider: string;
  providers: { id: string; name: string }[];
  rows: CityMapRowView[];
  courierCities: City[];
  loadError: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pending, error, runAction } = useAction();
  const [filter, setFilter] = useState<"all" | "unmapped" | "ordered">("unmapped");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "unmapped" && row.mapping) return false;
      if (filter === "ordered" && row.orderCount === 0) return false;
      if (needle && !row.markCity.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, filter, query]);

  const unmappedWithOrders = rows.filter((r) => !r.mapping && r.orderCount > 0);

  function save(markCity: string, courierCityId: string) {
    const city = courierCities.find((c) => c.id === courierCityId);
    runAction(
      () =>
        saveCityMappingAction({
          provider,
          markCity,
          courierCityId,
          courierCityName: city?.name ?? courierCityId,
        }),
      { success: `${markCity} mapped` },
    );
  }

  return (
    <div className="space-y-3">
      <ErrorNote message={error} />

      {loadError ? (
        <p className="rounded border border-[#e8b4b0] bg-[var(--a-danger-bg)] px-2.5 py-2 text-[12px] text-[var(--a-danger)]">
          <strong>Could not load this courier&rsquo;s city list.</strong> {loadError}
        </p>
      ) : null}

      {unmappedWithOrders.length > 0 ? (
        <p
          role="alert"
          className="rounded border border-[#e6cfa0] bg-[var(--a-warn-bg)] px-2.5 py-2 text-[12px] text-[var(--a-warn)]"
        >
          <strong>
            {unmappedWithOrders.length} cit{unmappedWithOrders.length === 1 ? "y has" : "ies have"} orders but no
            mapping.
          </strong>{" "}
          Booking will refuse for {unmappedWithOrders.slice(0, 6).map((r) => r.markCity).join(", ")}
          {unmappedWithOrders.length > 6 ? ` and ${unmappedWithOrders.length - 6} more` : ""}.
        </p>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-end gap-2 p-3">
          <div>
            <label htmlFor="cm-provider" className="a-label">
              Courier
            </label>
            <select
              id="cm-provider"
              className="a-select"
              value={provider}
              onChange={(e) => router.push(`/admin/integrations/cities?provider=${e.target.value}`)}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cm-filter" className="a-label">
              Show
            </label>
            <select
              id="cm-filter"
              className="a-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="unmapped">Unmapped only</option>
              <option value="ordered">Cities with orders</option>
              <option value="all">Every city</option>
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <label htmlFor="cm-search" className="a-label">
              Find a city
            </label>
            <input
              id="cm-search"
              className="a-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Karachi"
            />
          </div>
        </div>

        <div className="a-scroll">
          <table className="a-table">
            <thead>
              <tr>
                <th>MARK city</th>
                <th className="a-num">Orders</th>
                <th>Courier city</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-[var(--a-soft)]">
                    Nothing to show with these filters.
                  </td>
                </tr>
              ) : (
                visible.map((row) => {
                  const selected = draft[row.markCity] ?? row.mapping?.courierCityId ?? row.suggestion?.id ?? "";
                  return (
                    <tr key={row.markCity}>
                      <td className="font-medium">{row.markCity}</td>
                      <td className="a-num">{row.orderCount || "—"}</td>
                      <td>
                        {courierCities.length === 0 ? (
                          <input
                            className="a-input a-input-xs"
                            placeholder="City id from the courier"
                            disabled={!canWrite}
                            value={draft[row.markCity] ?? row.mapping?.courierCityId ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, [row.markCity]: e.target.value }))}
                          />
                        ) : (
                          <select
                            className="a-select"
                            aria-label={`Courier city for ${row.markCity}`}
                            disabled={!canWrite}
                            value={selected}
                            onChange={(e) => setDraft((d) => ({ ...d, [row.markCity]: e.target.value }))}
                          >
                            <option value="">Not mapped</option>
                            {courierCities.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {!row.mapping && row.suggestion ? (
                          <p className="a-hint">
                            Suggested: {row.suggestion.name} ({Math.round(row.suggestion.score * 100)}% match). Confirm
                            it before it is used.
                          </p>
                        ) : null}
                        {row.mapping?.confirmedAt ? (
                          <p className="a-hint">Confirmed by a person.</p>
                        ) : row.mapping ? (
                          <p className="a-hint">Stored, not yet confirmed.</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap">
                        {canWrite ? (
                          <>
                            <button
                              type="button"
                              className="a-btn a-btn-xs"
                              disabled={pending || !selected || selected === row.mapping?.courierCityId}
                              onClick={() => save(row.markCity, selected)}
                            >
                              {row.mapping ? "Update" : "Confirm"}
                            </button>
                            {row.mapping ? (
                              <button
                                type="button"
                                className="a-btn a-btn-xs ml-1"
                                disabled={pending}
                                onClick={() =>
                                  runAction(() => deleteCityMappingAction(provider, row.markCity), {
                                    success: "Mapping removed",
                                  })
                                }
                              >
                                Remove
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
