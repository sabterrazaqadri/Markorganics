/**
 * Simple in-memory sliding-window rate limiter keyed by an arbitrary string (IP).
 *
 * On serverless hosts each warm instance keeps its own counter, so this is a
 * spam speed-bump rather than a hard guarantee. Swap the Map for a Neon table
 * if you need cross-instance accuracy.
 */
interface Bucket {
  hits: number[];
}

const globalForRl = globalThis as unknown as { __mrkRateLimit?: Map<string, Bucket> };
const buckets = globalForRl.__mrkRateLimit ?? new Map<string, Bucket>();
globalForRl.__mrkRateLimit = buckets;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return { ok: false, remaining: 0, retryAfterMs: windowMs - (now - oldest) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return { ok: true, remaining: max - bucket.hits.length, retryAfterMs: 0 };
}
