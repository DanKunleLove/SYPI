import { prisma } from "@/lib/prisma";

/**
 * Platform kill switches. A missing row = enabled; rows only appear once an
 * admin flips a switch on /admin/ai. Checked at the choke points (AI quota,
 * user auto-create) so one toggle takes effect platform-wide immediately.
 */

export type PlatformFlagId =
  | "ai_enabled"
  | "generation_enabled"
  | "kit_enabled"
  | "deep_reasoning_enabled"
  | "signups_enabled";

export const PLATFORM_FLAGS: {
  id: PlatformFlagId;
  label: string;
  description: string;
}[] = [
  {
    id: "ai_enabled",
    label: "All AI features",
    description: "Master switch — disables every AI call (generate, kit, chat, review…).",
  },
  {
    id: "generation_enabled",
    label: "Architecture generation",
    description: "Prompt/URL → canvas generation, including the agent tool.",
  },
  {
    id: "kit_enabled",
    label: "System Kit",
    description: "Kit generation (the most expensive feature: 5-7 LLM calls each).",
  },
  {
    id: "deep_reasoning_enabled",
    label: "Deep reasoning",
    description:
      "The multi-pass requirements pipeline (BYOK only). Turning this off leaves the fast path untouched.",
  },
  {
    id: "signups_enabled",
    label: "New signups",
    description: "New-account creation. Existing users are unaffected.",
  },
];

/** Of the given flags, return the ids that are currently DISABLED. */
export async function getDisabledFlags(
  ids: PlatformFlagId[]
): Promise<Set<PlatformFlagId>> {
  const rows = await prisma.platformFlag.findMany({
    where: { id: { in: ids }, enabled: false },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id as PlatformFlagId));
}

export async function isFlagEnabled(id: PlatformFlagId): Promise<boolean> {
  const row = await prisma.platformFlag.findUnique({ where: { id } });
  return row?.enabled ?? true;
}
