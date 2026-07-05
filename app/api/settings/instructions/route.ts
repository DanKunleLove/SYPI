import { getDbUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { MAX_INSTRUCTIONS_CHARS } from "@/lib/ai/index";

/** The user's custom instructions — the user layer appended to all AI prompts. */
export async function GET() {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { customInstructions: true },
  });
  return Response.json({ instructions: record?.customInstructions ?? "" });
}

/** Set (or clear with empty string) the user's custom instructions. */
export async function PUT(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { instructions?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.instructions !== "string") {
    return Response.json({ error: "instructions must be a string" }, { status: 400 });
  }
  if (body.instructions.length > MAX_INSTRUCTIONS_CHARS) {
    return Response.json(
      { error: `Instructions too long (max ${MAX_INSTRUCTIONS_CHARS} characters)` },
      { status: 400 }
    );
  }

  const instructions = body.instructions.trim();
  await prisma.user.update({
    where: { id: user.id },
    data: { customInstructions: instructions || null },
  });
  return Response.json({ ok: true, instructions });
}
