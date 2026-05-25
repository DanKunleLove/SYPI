import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyProjects, getSharedProjects } from "@/lib/actions/project";
import { HomeClient } from "./home-client";

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let myProjects: Awaited<ReturnType<typeof getMyProjects>> = [];
  let sharedProjects: Awaited<ReturnType<typeof getSharedProjects>> = [];

  try {
    [myProjects, sharedProjects] = await Promise.all([
      getMyProjects(),
      getSharedProjects(),
    ]);
  } catch {
    // User not synced yet — show empty state
  }

  const myProjectCards = myProjects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    updatedAt: p.updatedAt.toISOString(),
    collaboratorCount: p._count.collaborators,
  }));

  const sharedProjectCards = sharedProjects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    updatedAt: p.updatedAt.toISOString(),
    collaboratorCount: p._count.collaborators,
    owner: p.owner,
  }));

  return (
    <HomeClient
      myProjects={myProjectCards}
      sharedProjects={sharedProjectCards}
    />
  );
}
