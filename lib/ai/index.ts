import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
});

/** Get a Gemini model by tier.
 *
 * Note: gemini-2.5-pro is NOT available on the Gemini free tier (quota limit 0),
 * so the "pro" tier falls back to flash by default. Set GEMINI_PRO_MODEL
 * (e.g. "gemini-2.5-pro") once billing is enabled to use a stronger model.
 */
export function getModel(tier: "flash" | "pro" = "flash") {
  const proModel = process.env.GEMINI_PRO_MODEL ?? "gemini-2.5-flash";
  const modelId = tier === "pro" ? proModel : "gemini-2.5-flash";
  return google(modelId);
}
