"use client";

import { motion } from "framer-motion";
import { Plus, Box, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromptBar } from "@/components/editor/prompt-bar";
import { CanvasArea } from "@/components/editor/canvas-area";
import { formatRelativeTime, type Project } from "@/lib/mock-projects";

export default function EditorPage() {
  return null;
}

/** Shown when no project is active — the editor "home" screen */
export function EditorHome({
  projects,
  loading,
  onNewProject,
  onProjectClick,
}: {
  projects: Project[];
  loading?: boolean;
  onNewProject: () => void;
  onProjectClick: (id: string) => void;
}) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center overflow-y-auto"
      style={{
        backgroundColor: "var(--bg-base)",
        backgroundImage:
          "radial-gradient(circle, var(--border-default) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-center gap-4 pt-24 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-surface)]">
          <GitBranch className="h-8 w-8 text-[var(--text-muted)]" />
        </div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Create a project or open an existing one
        </h1>
        <p className="max-w-md text-sm text-[var(--text-secondary)]">
          Start a new architecture workspace, or choose a project from the
          sidebar.
        </p>
        <Button
          className="mt-2 gap-2"
          onClick={onNewProject}
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </motion.div>

      {/* Recent projects grid */}
      {loading && (
        <div className="mt-12 w-full max-w-3xl px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]"
              />
            ))}
          </div>
        </div>
      )}
      {!loading && projects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
          className="mt-12 w-full max-w-3xl px-6 pb-24"
        >
          <h2 className="mb-4 text-sm font-medium text-[var(--text-secondary)]">
            Recent projects
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onProjectClick(project.id)}
                className="group flex flex-col gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-left transition-all hover:border-[var(--border-subtle)] hover:shadow-lg hover:shadow-black/10"
              >
                {/* Header row */}
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="flex-1 truncate text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-hover)]">
                    {project.name}
                  </span>
                </div>

                {/* Description */}
                {project.description && (
                  <p className="line-clamp-2 text-xs text-[var(--text-muted)]">
                    {project.description}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                  <span>{formatRelativeTime(project.lastEdited)}</span>
                  <div className="flex items-center gap-1">
                    <Box className="h-3 w-3" />
                    <span>
                      {project.nodeCount} node{project.nodeCount !== 1 && "s"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/** Shown when a project is active — canvas + prompt bar */
export function EditorCanvas() {
  return (
    <>
      <CanvasArea />
      <PromptBar />
    </>
  );
}
