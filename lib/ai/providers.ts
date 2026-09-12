import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/** Providers users can bring their own key for. */
export type ProviderId = "anthropic" | "openai" | "google" | "nvidia";

/** NVIDIA NIM is OpenAI-compatible; it is reached through the OpenAI provider. */
export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export interface ModelOption {
  id: string;
  label: string;
}

export interface ProviderDef {
  id: ProviderId;
  label: string;
  /** Where to obtain a key — shown in the settings UI. */
  consoleUrl: string;
  keyPrefix: string;
  models: ModelOption[];
  /** Defaults used when a key exists but no explicit model is chosen. */
  defaults: { flash: string; pro: string };
  create: (apiKey: string, modelId: string) => LanguageModel;
}

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    keyPrefix: "sk-ant-",
    models: [
      { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ],
    defaults: { flash: "claude-haiku-4-5", pro: "claude-opus-4-8" },
    create: (apiKey, modelId) => createAnthropic({ apiKey })(modelId),
  },
  openai: {
    id: "openai",
    label: "OpenAI (GPT)",
    consoleUrl: "https://platform.openai.com/api-keys",
    keyPrefix: "sk-",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
    ],
    defaults: { flash: "gpt-4o-mini", pro: "gpt-4o" },
    create: (apiKey, modelId) => createOpenAI({ apiKey })(modelId),
  },
  google: {
    id: "google",
    label: "Google (Gemini)",
    consoleUrl: "https://aistudio.google.com/app/apikey",
    keyPrefix: "AI",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
    defaults: { flash: "gemini-2.5-flash", pro: "gemini-2.5-pro" },
    create: (apiKey, modelId) => createGoogleGenerativeAI({ apiKey })(modelId),
  },
  nvidia: {
    id: "nvidia",
    label: "NVIDIA NIM",
    consoleUrl: "https://build.nvidia.com/settings/api-keys",
    keyPrefix: "nvapi-",
    // Only models VERIFIED to work with generateObject against this endpoint are
    // listed. The catalogue advertises ~82, but many return "Not Found" when
    // actually called, and structured output is what our whole pipeline needs.
    models: [
      { id: "nvidia/nemotron-3-ultra-550b-a55b", label: "Nemotron 3 Ultra 550B" },
      { id: "nvidia/nemotron-3-super-120b-a12b", label: "Nemotron 3 Super 120B" },
    ],
    defaults: {
      flash: "nvidia/nemotron-3-super-120b-a12b",
      pro: "nvidia/nemotron-3-ultra-550b-a55b",
    },
    // Verified: generateObject works against this endpoint with the provider's
    // default settings. Responses are slow (30-100s for a full architecture), so
    // callers should budget for it.
    create: (apiKey, modelId) =>
      createOpenAI({ apiKey, baseURL: NVIDIA_BASE_URL, name: "nvidia" })(modelId),
  },
};

/** Display order — strongest-bar provider first. */
export const PROVIDER_ORDER: ProviderId[] = ["anthropic", "openai", "google", "nvidia"];

export function isProviderId(value: string): value is ProviderId {
  return (
    value === "anthropic" ||
    value === "openai" ||
    value === "google" ||
    value === "nvidia"
  );
}

/** A model reference is stored as "provider:modelId" (e.g. "anthropic:claude-opus-4-8"). */
export interface ModelRef {
  provider: ProviderId;
  modelId: string;
}

export function parseModelRef(ref: string): ModelRef | null {
  const idx = ref.indexOf(":");
  if (idx === -1) return null;
  const provider = ref.slice(0, idx);
  const modelId = ref.slice(idx + 1);
  if (!isProviderId(provider) || !modelId) return null;
  // Only accept models we actually expose.
  if (!PROVIDERS[provider].models.some((m) => m.id === modelId)) return null;
  return { provider, modelId };
}

export function formatModelRef(provider: ProviderId, modelId: string): string {
  return `${provider}:${modelId}`;
}
