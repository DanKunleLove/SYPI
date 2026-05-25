import { getProjectWithAccess } from "@/lib/project-access";
import { AccessDenied } from "@/components/editor/access-denied";
import { ProjectWorkspace } from "@/components/workspace/project-workspace";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { project } = await getProjectWithAccess(projectId);

  if (!project) {
    return <AccessDenied />;
  }

  return (
    <ProjectWorkspace
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
      }}
    />
  );
}
