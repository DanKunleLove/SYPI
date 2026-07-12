import { prisma } from "@/lib/prisma";

/**
 * Activation/retention metrics computed from our own data (User, AIGeneration,
 * UsageEvent). Activation event = first completed generation (the value moment);
 * deep value = System Kit / exports.
 *
 * Computed in JS over bounded queries — fine at current scale; move to SQL
 * aggregates when user counts make these fetches heavy.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface CohortRow {
  weekStart: string; // ISO date (Monday)
  signups: number;
  activatedPct: number | null; // % activated within 7 days of signup
  week2ReturnPct: number | null; // % active again in days 7-14
}

export interface PlatformMetrics {
  totalUsers: number;
  activationRatePct: number | null; // all-time: % of users activated within 7d of signup
  medianTtvMinutes: number | null; // signup → first completed generation
  totalGenerations: number;
  kitsGenerated: number;
  kitsByDomain: Record<string, number>;
  exports: number;
  thumbsUp: number;
  thumbsDown: number;
  openFeedback: number;
  cohorts: CohortRow[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d;
}

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  const [users, generations, kitEvents, exportCount, thumbsUp, thumbsDown, openFeedback] =
    await Promise.all([
      prisma.user.findMany({ select: { id: true, createdAt: true } }),
      prisma.aIGeneration.findMany({
        where: { status: "completed" },
        select: { createdAt: true, project: { select: { userId: true } } },
        orderBy: { createdAt: "asc" },
        take: 10_000,
      }),
      prisma.usageEvent.findMany({
        where: { type: "kit_generated" },
        select: { userId: true, meta: true, createdAt: true },
        take: 5_000,
      }),
      prisma.usageEvent.count({
        where: {
          type: { in: ["spec_exported", "png_exported", "mermaid_exported", "bundle_exported"] },
        },
      }),
      prisma.aIGeneration.count({ where: { rating: 1 } }),
      prisma.aIGeneration.count({ where: { rating: -1 } }),
      prisma.feedback.count({ where: { status: "open" } }),
    ]);

  // First completed generation per user (generations are owner-attributed via project).
  const firstGenAt = new Map<string, Date>();
  for (const g of generations) {
    const uid = g.project.userId;
    if (!firstGenAt.has(uid)) firstGenAt.set(uid, g.createdAt);
  }

  // Any activity timestamp per user (for week-2 return), cheap union.
  const activityByUser = new Map<string, Date[]>();
  for (const g of generations) {
    const uid = g.project.userId;
    (activityByUser.get(uid) ?? activityByUser.set(uid, []).get(uid)!).push(g.createdAt);
  }
  for (const e of kitEvents) {
    (activityByUser.get(e.userId) ?? activityByUser.set(e.userId, []).get(e.userId)!).push(
      e.createdAt
    );
  }

  // All-time activation + TTV.
  let activated = 0;
  const ttvMinutes: number[] = [];
  for (const u of users) {
    const first = firstGenAt.get(u.id);
    if (first && first.getTime() - u.createdAt.getTime() <= WEEK_MS) {
      activated++;
      ttvMinutes.push((first.getTime() - u.createdAt.getTime()) / 60_000);
    }
  }

  // Weekly cohorts, last 8 weeks.
  const cohorts: CohortRow[] = [];
  const thisMonday = mondayOf(new Date());
  for (let i = 7; i >= 0; i--) {
    const start = new Date(thisMonday.getTime() - i * WEEK_MS);
    const end = new Date(start.getTime() + WEEK_MS);
    const cohort = users.filter((u) => u.createdAt >= start && u.createdAt < end);
    if (cohort.length === 0) {
      cohorts.push({
        weekStart: start.toISOString().slice(0, 10),
        signups: 0,
        activatedPct: null,
        week2ReturnPct: null,
      });
      continue;
    }
    let cohortActivated = 0;
    let cohortReturned = 0;
    let returnMeasurable = 0;
    const now = Date.now();
    for (const u of cohort) {
      const first = firstGenAt.get(u.id);
      if (first && first.getTime() - u.createdAt.getTime() <= WEEK_MS) cohortActivated++;
      const w2start = u.createdAt.getTime() + WEEK_MS;
      const w2end = u.createdAt.getTime() + 2 * WEEK_MS;
      if (now >= w2start) {
        returnMeasurable++;
        const activity = activityByUser.get(u.id) ?? [];
        if (activity.some((d) => d.getTime() >= w2start && d.getTime() < w2end)) {
          cohortReturned++;
        }
      }
    }
    cohorts.push({
      weekStart: start.toISOString().slice(0, 10),
      signups: cohort.length,
      activatedPct: Math.round((cohortActivated / cohort.length) * 100),
      week2ReturnPct:
        returnMeasurable > 0 ? Math.round((cohortReturned / returnMeasurable) * 100) : null,
    });
  }

  const kitsByDomain: Record<string, number> = {};
  for (const e of kitEvents) {
    const domain =
      e.meta && typeof e.meta === "object" && "domain" in e.meta
        ? String((e.meta as Record<string, unknown>).domain)
        : "software";
    kitsByDomain[domain] = (kitsByDomain[domain] ?? 0) + 1;
  }

  return {
    totalUsers: users.length,
    activationRatePct:
      users.length > 0 ? Math.round((activated / users.length) * 100) : null,
    medianTtvMinutes: median(ttvMinutes),
    totalGenerations: generations.length,
    kitsGenerated: kitEvents.length,
    kitsByDomain,
    exports: exportCount,
    thumbsUp,
    thumbsDown,
    openFeedback,
    cohorts,
  };
}
