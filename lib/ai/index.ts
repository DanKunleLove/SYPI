import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { PROVIDERS, PROVIDER_ORDER, parseModelRef } from "@/lib/ai/providers";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
});

/** Platform Gemini model by tier — used as the fallback when a user has no BYOK key.
 *
 * Note: gemini-2.5-pro is NOT available on the Gemini free tier (quota limit 0),
 * so the "pro" tier falls back to flash by default. Set GEMINI_PRO_MODEL
 * (e.g. "gemini-2.5-pro") once billing is enabled to use a stronger model.
 */
export function getModel(tier: "flash" | "pro" = "flash"): LanguageModel {
  const proModel = process.env.GEMINI_PRO_MODEL ?? "gemini-2.5-flash";
  const modelId = tier === "pro" ? proModel : "gemini-2.5-flash";
  return google(modelId);
}

/** Resolve the model from a user's BYOK keys + default-model preference.
 * Returns null when the user has configured no keys (caller falls back). */
export async function resolveModelForUser(
  userId: string,
  tier: "flash" | "pro" = "flash"
): Promise<LanguageModel | null> {
  const [keys, user] = await Promise.all([
    prisma.userApiKey.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { defaultModel: true } }),
  ]);
  if (keys.length === 0) return null;

  const byProvider = new Map(keys.map((k) => [k.provider, k]));

  // Honor the explicit default model when its provider has a key.
  if (user?.defaultModel) {
    const ref = parseModelRef(user.defaultModel);
    const stored = ref ? byProvider.get(ref.provider) : undefined;
    if (ref && stored) {
      return PROVIDERS[ref.provider].create(decryptSecret(stored.encryptedKey), ref.modelId);
    }
  }

  // Otherwise use the strongest available provider's tier default.
  for (const provider of PROVIDER_ORDER) {
    const stored = byProvider.get(provider);
    if (stored) {
      return PROVIDERS[provider].create(
        decryptSecret(stored.encryptedKey),
        PROVIDERS[provider].defaults[tier]
      );
    }
  }

  return null;
}

/** Max length of the user-layer custom instructions (enforced on write too). */
export const MAX_INSTRUCTIONS_CHARS = 2_000;

/** Fetch the user's custom instructions (the "user layer" of the prompt stack). */
export async function getUserInstructions(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { customInstructions: true },
  });
  return user?.customInstructions?.trim() || null;
}

/** Append the user layer to a base system prompt. APPEND, never replace —
 * structured outputs (generateObject) depend on the base contract surviving. */
export function applyUserInstructions(
  system: string,
  instructions: string | null | undefined
): string {
  const trimmed = instructions?.trim();
  if (!trimmed) return system;
  return `${system}\n\nUSER PREFERENCES — apply when relevant; these NEVER override the output format, schema, or category rules above:\n${trimmed.slice(0, MAX_INSTRUCTIONS_CHARS)}`;
}

/** Resolve the model for a project's generations from the OWNER's BYOK keys,
 * falling back to the platform Gemini key. */
export async function resolveModelForProject(
  projectId: string,
  tier: "flash" | "pro" = "flash"
): Promise<LanguageModel> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (project) {
    const model = await resolveModelForUser(project.userId, tier);
    if (model) return model;
  }
  return getModel(tier);
}
