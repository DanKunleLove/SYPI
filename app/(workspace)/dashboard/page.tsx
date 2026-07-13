import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyProjects, getSharedProjects } from "@/lib/actions/project";
import { getDbUser } from "@/lib/project-access";
import { getChecklist, type ChecklistState } from "@/lib/onboarding";
import { HomeClient } from "./home-client";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let myProjects: Awaited<ReturnType<typeof getMyProjects>> = [];
  let sharedProjects: Awaited<ReturnType<typeof getSharedProjects>> = [];
  let checklist: ChecklistState | null = null;

  try {
    const user = await getDbUser();
    [myProjects, sharedProjects, checklist] = await Promise.all([
      getMyProjects(),
      getSharedProjects(),
      user ? getChecklist(user.id) : null,
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
    thumbnailUrl: p.thumbnailUrl ?? null,
  }));

  const sharedProjectCards = sharedProjects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    updatedAt: p.updatedAt.toISOString(),
    collaboratorCount: p._count.collaborators,
    thumbnailUrl: p.thumbnailUrl ?? null,
    owner: p.owner,
  }));

  return (
    <HomeClient
      myProjects={myProjectCards}
      sharedProjects={sharedProjectCards}
      checklist={checklist}
    />
  );
}
