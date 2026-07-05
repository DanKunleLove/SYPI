/**
 * In-memory sliding-window rate limiter.
 *
 * Per serverless instance: a warm instance enforces it, a cold start resets it.
 * That's enough to stop rapid-fire abuse without adding infra. Durable caps
 * (e.g. generations/day) are enforced against the DB in the routes that need them.
 */

const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may retry (0 when ok). */
  retryAfter: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfter: Math.ceil((hits[0] + windowMs - now) / 1000) };
  }

  hits.push(now);
  buckets.set(key, hits);

  // Opportunistic cleanup so the map doesn't grow unbounded on long-lived instances.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.length === 0 || now - v[v.length - 1] > windowMs) buckets.delete(k);
    }
  }

  return { ok: true, retryAfter: 0 };
}

export function rateLimitResponse(retryAfter: number): Response {
  return Response.json(
    { error: `Too many requests. Try again in ${Math.max(retryAfter, 1)}s.` },
    { status: 429, headers: { "Retry-After": String(Math.max(retryAfter, 1)) } }
  );
}
