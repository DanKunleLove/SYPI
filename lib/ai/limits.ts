import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * Central AI usage limits: per-kind burst (in-memory, per warm instance) +
 * durable daily quota counted via UsageEvent (`ai:{kind}`), so it survives
 * cold starts and gives the admin per-user usage rollups for free.
 *
 * BYOK users get higher daily caps — their generations run on their own
 * provider key, so the platform Gemini quota isn't at stake. (Model resolution
 * is owner-keyed per project; quota is enforced on the CALLING user. A
 * collaborator without keys working in a BYOK owner's project still gets the
 * platform caps — deliberate, it bounds worst-case platform spend.)
 *
 * Phase 2 adds per-user admin overrides; Phase 3 adds kill-switch flags here —
 * this function is the single choke point for every AI route.
 */

export type AiKind =
  | "generate"
  | "kit"
  | "critique"
  | "refine"
  | "spec"
  | "chat"
  | "plan";

interface KindLimits {
  burst: number;
  burstWindowMs: number;
  /** Per 24h on the platform key. */
  daily: number;
  /** Per 24h when the user has at least one BYOK provider key. */
  byokDaily: number;
}

export const AI_LIMITS: Record<AiKind, KindLimits> = {
  generate: { burst: 6, burstWindowMs: 60_000, daily: 100, byokDaily: 500 },
  // Kits are 5-7 LLM calls each — tight burst, low daily.
  kit: { burst: 3, burstWindowMs: 600_000, daily: 10, byokDaily: 50 },
  critique: { burst: 6, burstWindowMs: 60_000, daily: 30, byokDaily: 150 },
  refine: { burst: 6, burstWindowMs: 60_000, daily: 60, byokDaily: 300 },
  spec: { burst: 6, burstWindowMs: 60_000, daily: 30, byokDaily: 150 },
  chat: { burst: 20, burstWindowMs: 60_000, daily: 300, byokDaily: 1500 },
  plan: { burst: 15, burstWindowMs: 60_000, daily: 100, byokDaily: 500 },
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Check burst + daily quota for one AI call and record it. Call AFTER auth
 * and project-access checks (unauthorized requests must not burn quota).
 * String-error form for agent tools, which must return tool results, not
 * HTTP responses.
 */
export async function checkAiQuota(
  userId: string,
  kind: AiKind
): Promise<{ ok: true } | { ok: false; error: string; retryAfter: number }> {
  const limits = AI_LIMITS[kind];

  const burst = checkRateLimit(`${kind}:${userId}`, limits.burst, limits.burstWindowMs);
  if (!burst.ok) {
    return {
      ok: false,
      error: `Too many requests. Try again in ${Math.max(burst.retryAfter, 1)}s.`,
      retryAfter: burst.retryAfter,
    };
  }

  const dayAgo = new Date(Date.now() - DAY_MS);
  const [used, byokKeys] = await Promise.all([
    prisma.usageEvent.count({
      where: { userId, type: `ai:${kind}`, createdAt: { gte: dayAgo } },
    }),
    prisma.userApiKey.count({ where: { userId } }),
  ]);

  const cap = byokKeys > 0 ? limits.byokDaily : limits.daily;
  if (used >= cap) {
    return {
      ok: false,
      error:
        byokKeys > 0
          ? `Daily ${kind} limit reached (${cap}/24h). Resets within 24 hours.`
          : `Daily ${kind} limit reached (${cap}/24h). Add your own API key in Settings for higher limits, or try again later.`,
      retryAfter: 0,
    };
  }

  // Count the attempt up-front — a call that reaches the model spends quota
  // whether or not it succeeds.
  await prisma.usageEvent.create({ data: { userId, type: `ai:${kind}` } });

  return { ok: true };
}

/** Route form of checkAiQuota: a ready 429 Response, or null when allowed. */
export async function enforceAiQuota(
  userId: string,
  kind: AiKind
): Promise<Response | null> {
  const result = await checkAiQuota(userId, kind);
  if (result.ok) return null;
  return Response.json(
    { error: result.error },
    {
      status: 429,
      headers:
        result.retryAfter > 0
          ? { "Retry-After": String(Math.max(result.retryAfter, 1)) }
          : undefined,
    }
  );
}
