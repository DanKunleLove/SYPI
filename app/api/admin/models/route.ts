import { getAdminUser } from "@/lib/admin";
import { parseModelRef } from "@/lib/ai/providers";
import {
  getPlatformModelRef,
  platformProviders,
  serverKeyFor,
  setPlatformModelRef,
} from "@/lib/ai/platform-model";

/** Admin: which model the platform uses for users without their own key. */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({
    current: await getPlatformModelRef(),
    providers: platformProviders(),
  });
}

/** Admin: set (or clear, with null) the platform model. */
export async function PUT(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "Not found" }, { status: 404 });

  let body: { model?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.model === null) {
    await setPlatformModelRef(null);
    return Response.json({ current: null });
  }

  if (typeof body.model !== "string") {
    return Response.json(
      { error: "model must be a \"provider:modelId\" string, or null to reset" },
      { status: 400 }
    );
  }

  // Only whitelisted provider/model pairs — same constraint BYOK enforces.
  const parsed = parseModelRef(body.model);
  if (!parsed) {
    return Response.json({ error: "Unknown provider or model" }, { status: 400 });
  }

  // Selecting a model the server has no key for would silently fall back to the
  // default and look like the setting did nothing. Refuse it instead.
  if (!serverKeyFor(parsed.provider)) {
    return Response.json(
      {
        error: `The server has no API key configured for ${parsed.provider}. Set it in the environment first.`,
      },
      { status: 400 }
    );
  }

  await setPlatformModelRef(body.model);
  return Response.json({ current: body.model });
}
