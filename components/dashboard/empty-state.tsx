import { FolderOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  variant,
  onCreateProject,
}: {
  variant: "my-projects" | "shared";
  onCreateProject?: () => void;
}) {
  const isShared = variant === "shared";

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-surface-raised)]">
        {isShared ? (
          <Users className="h-7 w-7 text-[var(--text-muted)]" />
        ) : (
          <FolderOpen className="h-7 w-7 text-[var(--text-muted)]" />
        )}
      </div>
      <h3 className="mt-4 text-lg font-medium text-[var(--text-primary)]">
        {isShared ? "No shared projects yet" : "No projects yet"}
      </h3>
      <p className="mt-1.5 max-w-xs text-sm text-[var(--text-secondary)]">
        {isShared
          ? "When someone shares a project with you, it will appear here."
          : "Create your first architecture workspace to get started."}
      </p>
      {!isShared && onCreateProject && (
        <Button className="mt-5" onClick={onCreateProject}>
          New Project
        </Button>
      )}
    </div>
  );
}
