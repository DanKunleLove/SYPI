import { getProjectWithAccess } from "@/lib/project-access";
import { AccessDenied } from "@/components/editor/access-denied";
import { WorkspaceShell } from "@/components/editor/workspace-shell";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const { project, reason } = await getProjectWithAccess(roomId);

  if (!project) {
    return <AccessDenied />;
  }

  return (
    <WorkspaceShell
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
      }}
    />
  );
}
