import type { LanguageModel } from "ai";
import { prisma } from "@/lib/prisma";
import {
  PROVIDERS,
  PROVIDER_ORDER,
  parseModelRef,
  type ProviderId,
  type ModelOption,
} from "@/lib/ai/providers";
import { getModel } from "@/lib/ai/index";

/**
 * The platform model — what users WITHOUT their own API key get.
 *
 * An admin picks it at /admin/ai. Selection is constrained to providers whose
 * server-side key is actually configured, because the platform model runs on the
 * platform's own credentials, never a user's.
 *
 * Missing setting = the code default (Gemini via getModel), mirroring how a
 * missing PlatformFlag row means "enabled".
 */

export const PLATFORM_MODEL_KEY = "platform_model";

/** Server-side key env var per provider. */
const SERVER_KEY_ENV: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_AI_API_KEY",
  nvidia: "NVIDIA_API_KEY",
};

export function serverKeyFor(provider: ProviderId): string | undefined {
  return process.env[SERVER_KEY_ENV[provider]] || undefined;
}

export interface AvailableProvider {
  id: ProviderId;
  label: string;
  models: ModelOption[];
  /** Env var the server reads for this provider's key. */
  keyEnv: string;
  configured: boolean;
}

/** Every provider, flagged by whether the server has a key for it. */
export function platformProviders(): AvailableProvider[] {
  return PROVIDER_ORDER.map((id) => ({
    id,
    label: PROVIDERS[id].label,
    models: PROVIDERS[id].models,
    keyEnv: SERVER_KEY_ENV[id],
    configured: Boolean(serverKeyFor(id)),
  }));
}

// Short in-process cache: an admin change should take effect quickly, but every
// AI call should not pay a database round-trip. Serverless runs many instances,
// so the TTL — not invalidation — is what actually bounds staleness.
const CACHE_TTL_MS = 30_000;
let cached: { ref: string | null; at: number } | null = null;

export async function getPlatformModelRef(): Promise<string | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.ref;
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { id: PLATFORM_MODEL_KEY },
    });
    cached = { ref: row?.value ?? null, at: Date.now() };
    return cached.ref;
  } catch {
    // Never let a settings lookup break generation.
    return cached?.ref ?? null;
  }
}

export async function setPlatformModelRef(ref: string | null): Promise<void> {
  if (ref === null) {
    await prisma.platformSetting.deleteMany({ where: { id: PLATFORM_MODEL_KEY } });
  } else {
    await prisma.platformSetting.upsert({
      where: { id: PLATFORM_MODEL_KEY },
      create: { id: PLATFORM_MODEL_KEY, value: ref },
      update: { value: ref },
    });
  }
  cached = { ref, at: Date.now() };
}

/**
 * Resolve the platform model for a tier.
 *
 * The admin selection names ONE model. For the "flash" tier we use that provider's
 * flash default instead, so cheap calls (critique, spec, chat) do not run on an
 * expensive reasoning model just because it was chosen for generation.
 */
export async function getPlatformModel(
  tier: "flash" | "pro" = "flash"
): Promise<LanguageModel> {
  const ref = await getPlatformModelRef();
  if (!ref) return getModel(tier);

  const parsed = parseModelRef(ref);
  if (!parsed) return getModel(tier);

  const key = serverKeyFor(parsed.provider);
  if (!key) return getModel(tier);

  const def = PROVIDERS[parsed.provider];
  const modelId = tier === "pro" ? parsed.modelId : def.defaults.flash;
  return def.create(key, modelId);
}
