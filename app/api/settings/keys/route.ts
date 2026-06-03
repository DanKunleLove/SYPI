import { getDbUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { encryptSecret, lastFour } from "@/lib/crypto";
import { PROVIDERS, PROVIDER_ORDER, isProviderId } from "@/lib/ai/providers";

/** List configured providers (last-4 only) + the user's default model + provider catalog. */
export async function GET() {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await prisma.userApiKey.findMany({
    where: { userId: user.id },
    select: { provider: true, last4: true, updatedAt: true },
  });
  const configured = new Map(keys.map((k) => [k.provider, k]));

  const providers = PROVIDER_ORDER.map((id) => {
    const def = PROVIDERS[id];
    const existing = configured.get(id);
    return {
      id,
      label: def.label,
      consoleUrl: def.consoleUrl,
      models: def.models,
      configured: Boolean(existing),
      last4: existing?.last4 ?? null,
    };
  });

  return Response.json({ providers, defaultModel: user.defaultModel ?? null });
}

/** Add or replace a provider key. */
export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { provider?: unknown; apiKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider, apiKey } = body;
  if (typeof provider !== "string" || !isProviderId(provider)) {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (typeof apiKey !== "string" || apiKey.trim().length < 8) {
    return Response.json({ error: "API key looks invalid" }, { status: 400 });
  }

  const trimmed = apiKey.trim();
  let encryptedKey: string;
  try {
    encryptedKey = encryptSecret(trimmed);
  } catch (error) {
    // ENCRYPTION_SECRET missing/misconfigured — surface clearly, don't store plaintext.
    return Response.json(
      { error: error instanceof Error ? error.message : "Encryption unavailable" },
      { status: 500 }
    );
  }

  await prisma.userApiKey.upsert({
    where: { userId_provider: { userId: user.id, provider } },
    create: { userId: user.id, provider, encryptedKey, last4: lastFour(trimmed) },
    update: { encryptedKey, last4: lastFour(trimmed) },
  });

  return Response.json({ ok: true, provider, last4: lastFour(trimmed) });
}

/** Remove a provider key. */
export async function DELETE(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const provider = new URL(request.url).searchParams.get("provider");
  if (!provider || !isProviderId(provider)) {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }

  await prisma.userApiKey.deleteMany({ where: { userId: user.id, provider } });

  // If the default model used this provider, clear it.
  if (user.defaultModel?.startsWith(`${provider}:`)) {
    await prisma.user.update({ where: { id: user.id }, data: { defaultModel: null } });
  }

  return Response.json({ ok: true });
}
