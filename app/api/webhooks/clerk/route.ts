import { Webhook } from "svix";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: { email_address: string }[];
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
  };
}

export async function POST(request: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  const payload = await request.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let event: ClerkWebhookEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const { type, data } = event;
  const email = data.email_addresses?.[0]?.email_address ?? null;
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

  if (type === "user.created" || type === "user.updated") {
    if (!email) {
      return new Response("No email on user", { status: 400 });
    }

    await prisma.user.upsert({
      where: { clerkId: data.id },
      create: {
        clerkId: data.id,
        email,
        name,
        imageUrl: data.image_url ?? null,
      },
      update: {
        email,
        name,
        imageUrl: data.image_url ?? null,
      },
    });

    // Link any existing collaborator invites to this user
    if (type === "user.created") {
      const user = await prisma.user.findUnique({ where: { clerkId: data.id } });
      if (user) {
        await prisma.collaborator.updateMany({
          where: { email, userId: null },
          data: { userId: user.id },
        });
      }
    }
  }

  if (type === "user.deleted") {
    // Cascade handled by Prisma relations — just delete the user
    await prisma.user.delete({
      where: { clerkId: data.id },
    }).catch(() => {
      // User may not exist in DB yet — ignore
    });
  }

  return new Response("OK", { status: 200 });
}
