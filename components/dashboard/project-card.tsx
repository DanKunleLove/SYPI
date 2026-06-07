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
  thumbnailUrl?: string | null;
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
      className="group relative flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-hidden transition-all hover:border-[var(--border-subtle)] hover:shadow-lg hover:shadow-black/10 cursor-pointer"
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
      {/* Thumbnail / preview */}
      <div className="relative h-28 w-full shrink-0 overflow-hidden">
        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt={`${project.name} preview`}
            className="h-full w-full object-cover object-top opacity-90 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: `${color}18` }}
          >
            <span
              className="text-3xl font-bold select-none"
              style={{ color: `${color}90` }}
            >
              {project.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {/* Three-dot menu — overlaid top-right */}
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-surface)]/90 backdrop-blur-sm border border-[var(--border-default)] hover:bg-[var(--bg-surface-raised)]"
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
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="flex-1 truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-hover)]">
            {project.name}
          </span>
        </div>

        {/* Description */}
        {project.description && (
          <p className="line-clamp-1 text-[11px] text-[var(--text-muted)]">
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
      </div>{/* end card body */}
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="h-[200px] animate-pulse rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]" />
  );
}
