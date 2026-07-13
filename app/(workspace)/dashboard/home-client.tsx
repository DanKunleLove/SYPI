"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, PanelLeftOpen } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { useSidebarState } from "@/components/workspace/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectGrid } from "@/components/dashboard/project-grid";
import { RenameProjectDialog } from "@/components/editor/rename-project-dialog";
import { DeleteProjectDialog } from "@/components/editor/delete-project-dialog";
import {
  renameProject,
  duplicateProject,
  deleteProject,
} from "@/lib/actions/project";
import type { ProjectCardData } from "@/components/dashboard/project-card";
import { toast } from "sonner";
import { dispatchCreateProject } from "@/hooks/use-create-project-event";
import { GettingStarted } from "@/components/dashboard/getting-started";
import type { ChecklistState } from "@/lib/onboarding";

export function HomeClient({
  myProjects: initialMyProjects,
  sharedProjects: initialSharedProjects,
  checklist,
}: {
  myProjects: ProjectCardData[];
  sharedProjects: ProjectCardData[];
  checklist: ChecklistState | null;
}) {
  const router = useRouter();
  const { collapsed, toggle: toggleSidebar } = useSidebarState();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"my" | "shared">("my");
  const [searchQuery, setSearchQuery] = useState("");
  const [renameTarget, setRenameTarget] = useState<ProjectCardData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectCardData | null>(null);

  const myProjects = initialMyProjects;
  const sharedProjects = initialSharedProjects;

  const filteredMy = useMemo(() => {
    if (!searchQuery.trim()) return myProjects;
    const q = searchQuery.toLowerCase();
    return myProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [myProjects, searchQuery]);

  const filteredShared = useMemo(() => {
    if (!searchQuery.trim()) return sharedProjects;
    const q = searchQuery.toLowerCase();
    return sharedProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [sharedProjects, searchQuery]);

  function handleOpen(id: string) {
    router.push(`/${id}`);
  }

  function handleRename(id: string) {
    const project = [...myProjects, ...sharedProjects].find((p) => p.id === id);
    if (project) setRenameTarget(project);
  }

  async function handleRenameConfirm(id: string, newName: string) {
    startTransition(async () => {
      try {
        await renameProject(id, newName);
        router.refresh();
        setRenameTarget(null);
      } catch {
        toast.error("Failed to rename project");
      }
    });
  }

  function handleDuplicate(id: string) {
    startTransition(async () => {
      try {
        await duplicateProject(id);
        router.refresh();
        toast.success("Project duplicated");
      } catch {
        toast.error("Failed to duplicate project");
      }
    });
  }

  function handleDelete(id: string) {
    const project = [...myProjects, ...sharedProjects].find((p) => p.id === id);
    if (project) setDeleteTarget(project);
  }

  async function handleDeleteConfirm(id: string) {
    startTransition(async () => {
      try {
        await deleteProject(id);
        router.refresh();
        toast.success("Project deleted");
        setDeleteTarget(null);
      } catch {
        toast.error("Failed to delete project");
      }
    });
  }

  function handleShare(id: string) {
    router.push(`/${id}?share=true`);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-6 gap-4">
        <div className="flex items-center gap-2">
          {collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Open sidebar"
              onClick={toggleSidebar}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}
          <Logo size="sm" showText={false} />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Dashboard
          </span>
        </div>

        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] py-1.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--border-subtle)]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="mx-auto max-w-5xl px-6 py-8"
        >
          {checklist && <GettingStarted initial={checklist} />}

          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "my" | "shared")}
            >
              <TabsList>
                <TabsTrigger value="my">My Projects</TabsTrigger>
                <TabsTrigger value="shared">Shared with Me</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              className="gap-2"
              onClick={dispatchCreateProject}
            >
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>

          {/* Grid */}
          {tab === "my" ? (
            <ProjectGrid
              projects={filteredMy}
              emptyVariant="my-projects"
              onOpen={handleOpen}
              onRename={handleRename}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onShare={handleShare}
              onCreateProject={dispatchCreateProject}
            />
          ) : (
            <ProjectGrid
              projects={filteredShared}
              emptyVariant="shared"
              onOpen={handleOpen}
              onRename={handleRename}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onShare={handleShare}
            />
          )}
        </motion.div>
      </div>

      {/* Proper dialogs — no window.prompt / window.confirm */}
      <RenameProjectDialog
        open={!!renameTarget}
        project={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={handleRenameConfirm}
      />
      <DeleteProjectDialog
        open={!!deleteTarget}
        project={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDelete={handleDeleteConfirm}
      />
    </div>
  );
}
