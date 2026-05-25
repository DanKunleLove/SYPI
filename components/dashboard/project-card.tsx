"use client";

import { MoreHorizontal, Copy, Pencil, Trash2, Share2, Box } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime, PROJECT_COLORS } from "@/lib/mock-projects";

export interface ProjectCardData {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  collaboratorCount: number;
  owner?: { name: string | null; imageUrl: string | null } | null;
}

export function ProjectCard({
  project,
  index,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onShare,
}: {
  project: ProjectCardData;
  index: number;
  onOpen: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  const color = PROJECT_COLORS[index % PROJECT_COLORS.length];

  return (
    <div
      className="group relative flex flex-col gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 transition-all hover:border-[var(--border-subtle)] hover:shadow-lg hover:shadow-black/10 cursor-pointer"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="flex-1 truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-hover)]">
          {project.name}
        </span>

        {/* Three-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1 hover:bg-[var(--bg-surface-raised)]"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4 text-[var(--text-muted)]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-[var(--state-error)] focus:text-[var(--state-error)]"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description */}
      {project.description && (
        <p className="line-clamp-2 text-xs text-[var(--text-muted)]">
          {project.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span title={new Date(project.updatedAt).toLocaleString()}>
          {formatRelativeTime(new Date(project.updatedAt))}
        </span>
        <div className="flex items-center gap-2">
          {project.owner && (
            <span className="truncate max-w-[100px]">{project.owner.name}</span>
          )}
          {project.collaboratorCount > 0 && (
            <div className="flex items-center gap-0.5">
              <Box className="h-3 w-3" />
              <span>{project.collaboratorCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="h-[120px] animate-pulse rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]" />
  );
}
