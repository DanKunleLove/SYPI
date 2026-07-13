import { prisma } from "@/lib/prisma";

/**
 * Getting-started checklist state, derived from real usage data (never
 * self-reported): the steps auto-check as the user actually reaches each
 * value moment. Step 1 IS the activation metric on /admin.
 */

export type ChecklistStepId = "generate" | "review" | "export";

export interface ChecklistState {
  steps: { id: ChecklistStepId; done: boolean }[];
  dismissed: boolean;
  complete: boolean;
}

const EXPORT_EVENT_TYPES = [
  "kit_generated",
  "spec_exported",
  "png_exported",
  "mermaid_exported",
  "bundle_exported",
];

export async function getChecklist(userId: string): Promise<ChecklistState> {
  const [generated, reviewedGen, reviewedEvent, exported, dismissed] =
    await Promise.all([
      prisma.aIGeneration.count({
        where: {
          project: { userId },
          status: "completed",
          type: { in: ["generation", "url-analysis"] },
        },
      }),
      prisma.aIGeneration.count({
        where: { project: { userId }, type: "critique" },
      }),
      prisma.usageEvent.count({ where: { userId, type: "ai:critique" } }),
      prisma.usageEvent.count({
        where: { userId, type: { in: EXPORT_EVENT_TYPES } },
      }),
      prisma.usageEvent.count({ where: { userId, type: "checklist_dismissed" } }),
    ]);

  const steps = [
    { id: "generate" as const, done: generated > 0 },
    { id: "review" as const, done: reviewedGen + reviewedEvent > 0 },
    { id: "export" as const, done: exported > 0 },
  ];

  return {
    steps,
    dismissed: dismissed > 0,
    complete: steps.every((s) => s.done),
  };
}
