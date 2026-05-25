"use client";

import { ProjectCard, ProjectCardSkeleton, type ProjectCardData } from "./project-card";
import { EmptyState } from "./empty-state";

export function ProjectGrid({
  projects,
  loading,
  emptyVariant,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onShare,
  onCreateProject,
}: {
  projects: ProjectCardData[];
  loading?: boolean;
  emptyVariant: "my-projects" | "shared";
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  onCreateProject?: () => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return <EmptyState variant={emptyVariant} onCreateProject={onCreateProject} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project, i) => (
        <ProjectCard
          key={project.id}
          project={project}
          index={i}
          onOpen={() => onOpen(project.id)}
          onRename={() => onRename(project.id)}
          onDuplicate={() => onDuplicate(project.id)}
          onDelete={() => onDelete(project.id)}
          onShare={() => onShare(project.id)}
        />
      ))}
    </div>
  );
}
