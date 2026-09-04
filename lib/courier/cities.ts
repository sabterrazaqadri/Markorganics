import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { courierCities, orders, type CourierCity } from "@/lib/db/schema";
import { PK_CITIES } from "@/lib/cities";
import { getCourier } from "./index";
import type { City } from "./types";

/**
 * MARK city -> courier city id.
 *
 * Auto-suggestion is a convenience only. Nothing is ever booked against a
 * suggested mapping: a person confirms each row, because a wrong city id is
 * the failure mode that quietly sends parcels to the wrong depot.
 */

export interface CityMapRow {
  markCity: string;
  /** Number of orders ever placed to this city — sort the work by what matters. */
  orderCount: number;
  mapping: { id: string; courierCityId: string; courierCityName: string; confirmedAt: Date | null } | null;
  suggestion: { id: string; name: string; score: number } | null;
}

export async function listMappings(provider: string): Promise<CourierCity[]> {
  return db.select().from(courierCities).where(eq(courierCities.provider, provider)).orderBy(courierCities.markCity);
}

/** Every city MARK actually ships to: the curated list plus anything typed at checkout. */
export async function knownCities(): Promise<{ city: string; orderCount: number }[]> {
  const rows = await db
    .select({ city: orders.city, n: sql<number>`count(*)::int` })
    .from(orders)
    .where(isNull(orders.deletedAt))
    .groupBy(orders.city)
    .orderBy(desc(sql`count(*)`));

  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.city.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + row.n);
  }
  for (const city of PK_CITIES) if (!counts.has(city)) counts.set(city, 0);

  return [...counts.entries()]
    .map(([city, orderCount]) => ({ city, orderCount }))
    .sort((a, b) => b.orderCount - a.orderCount || a.city.localeCompare(b.city));
}

export async function buildCityMap(provider: string): Promise<{ rows: CityMapRow[]; courierCities: City[]; error: string | null }> {
  const [mappings, cities, courierList] = await Promise.all([
    listMappings(provider),
    knownCities(),
    fetchCourierCities(provider),
  ]);

  const byCity = new Map(mappings.map((m) => [m.markCity.toLowerCase(), m]));
  const rows: CityMapRow[] = cities.map(({ city, orderCount }) => {
    const mapping = byCity.get(city.toLowerCase());
    return {
      markCity: city,
      orderCount,
      mapping: mapping
        ? {
            id: mapping.id,
            courierCityId: mapping.courierCityId,
            courierCityName: mapping.courierCityName,
            confirmedAt: mapping.confirmedAt,
          }
        : null,
      suggestion: mapping ? null : suggestCity(city, courierList.cities),
    };
  });

  return { rows, courierCities: courierList.cities, error: courierList.error };
}

async function fetchCourierCities(provider: string): Promise<{ cities: City[]; error: string | null }> {
  const adapter = getCourier(provider);
  if (!adapter) return { cities: [], error: `Unknown courier "${provider}".` };
  const result = await adapter.getCities();
  if (!result.ok) return { cities: [], error: result.error };
  return { cities: result.data, error: null };
}

/** Cities with orders but no confirmed mapping — the banner in admin lists these. */
export async function unmappedCities(provider: string): Promise<string[]> {
  const { rows } = await buildCityMap(provider);
  return rows.filter((r) => !r.mapping && r.orderCount > 0).map((r) => r.markCity);
}

export async function resolveCourierCityId(provider: string, markCity: string): Promise<string | null> {
  const [row] = await db
    .select({ courierCityId: courierCities.courierCityId })
    .from(courierCities)
    .where(and(eq(courierCities.provider, provider), sql`lower(${courierCities.markCity}) = lower(${markCity.trim()})`))
    .limit(1);
  return row?.courierCityId ?? null;
}

export async function saveMapping(input: {
  provider: string;
  markCity: string;
  courierCityId: string;
  courierCityName: string;
  userId: string;
}): Promise<void> {
  const values = {
    courierCityId: input.courierCityId.trim(),
    courierCityName: input.courierCityName.trim(),
    confirmedById: input.userId,
    confirmedAt: new Date(),
    updatedAt: new Date(),
  };
  await db
    .insert(courierCities)
    .values({ provider: input.provider, markCity: input.markCity.trim(), ...values })
    .onConflictDoUpdate({ target: [courierCities.provider, courierCities.markCity], set: values });
}

export async function deleteMapping(provider: string, markCity: string): Promise<void> {
  await db
    .delete(courierCities)
    .where(and(eq(courierCities.provider, provider), eq(courierCities.markCity, markCity)));
}

/* ------------------------------------------------------------- matching */

const NOISE = /\b(city|cantt|cantonment|tehsil|district|dist|division)\b/g;

export function normalizeCityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(NOISE, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Classic Levenshtein, capped at the shorter string's length. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = row;
  }
  return prev[b.length];
}

/** 0..1, where 1 is identical after normalisation. */
export function similarity(a: string, b: string): number {
  const x = normalizeCityName(a);
  const y = normalizeCityName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.startsWith(y) || y.startsWith(x)) return 0.92;
  const longest = Math.max(x.length, y.length);
  return Math.max(0, 1 - editDistance(x, y) / longest);
}

/** Best courier city for a MARK city, or null when nothing is close enough. */
export function suggestCity(markCity: string, cities: City[]): { id: string; name: string; score: number } | null {
  let best: { id: string; name: string; score: number } | null = null;
  for (const city of cities) {
    const score = similarity(markCity, city.name);
    if (!best || score > best.score) best = { id: city.id, name: city.name, score };
  }
  // Below this the suggestion is noise, and a wrong suggestion is worse than none.
  return best && best.score >= 0.7 ? best : null;
}
