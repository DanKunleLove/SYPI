"use client";

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar, useSidebarState } from "@/components/editor/sidebar";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { EditorHome, EditorCanvas } from "@/app/editor/page";
import { CreateProjectDialog } from "@/components/editor/create-project-dialog";
import { RenameProjectDialog } from "@/components/editor/rename-project-dialog";
import { DeleteProjectDialog } from "@/components/editor/delete-project-dialog";
import { useProjects } from "@/hooks/use-projects";
import { useProjectDialogs } from "@/hooks/use-project-dialogs";

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { collapsed, toggle } = useSidebarState();
  const {
    projects,
    filteredProjects,
    activeProject,
    activeProjectId,
    searchQuery,
    loading,
    setActiveProjectId,
    setSearchQuery,
    addProject,
    renameProject,
    deleteProject,
    duplicateProject,
  } = useProjects();

  const {
    dialogType,
    targetProject,
    openCreate,
    openRename,
    openDelete,
    close,
  } = useProjectDialogs();

  // Keyboard shortcut: [ to toggle sidebar
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "[" && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        toggle();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [toggle]);

  const handleCreate = useCallback(
    async (data: { name: string; description: string; template: string }) => {
      try {
        const project = await addProject(data);
        if (project) {
          toast.success("Project created", {
            description: `"${project.name}" is ready.`,
            duration: 3000,
          });
        } else {
          toast.error("Failed to create project", {
            description: "Please try again.",
            duration: 4000,
          });
        }
      } catch (error) {
        toast.error("Failed to create project", {
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
          duration: 4000,
        });
      }
    },
    [addProject]
  );

  const handleRename = useCallback(
    async (id: string, newName: string) => {
      try {
        const ok = await renameProject(id, newName);
        if (ok) {
          toast.success("Project renamed", { duration: 3000 });
        } else {
          toast.error("Failed to rename project", {
            description: "Please try again.",
            duration: 4000,
          });
        }
      } catch (error) {
        toast.error("Failed to rename project", {
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
          duration: 4000,
        });
      }
    },
    [renameProject]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const deleted = await deleteProject(id);
        if (deleted) {
          toast("Project deleted", {
            description: `"${deleted.name}" has been removed.`,
            duration: 5000,
          });
        } else {
          toast.error("Failed to delete project", {
            description: "Please try again.",
            duration: 4000,
          });
        }
      } catch (error) {
        toast.error("Failed to delete project", {
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
          duration: 4000,
        });
      }
    },
    [deleteProject]
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      const copy = await duplicateProject(id);
      if (copy) {
        toast.success("Project duplicated", {
          description: `"${copy.name}" created.`,
          duration: 3000,
        });
      } else {
        toast.error("Failed to duplicate project", {
          description: "Please try again.",
          duration: 4000,
        });
      }
    },
    [duplicateProject]
  );

  const pathname = usePathname();
  // When on /editor/[roomId], the workspace shell renders as children — skip editor home/canvas
  const isWorkspaceRoute = pathname !== "/editor" && pathname.startsWith("/editor/");

  // Mobile overlay state
  const isMobileOpen = !collapsed;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop scrim */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            key="mobile-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={toggle}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — overlay on mobile, inline on desktop */}
      <div className="z-50 md:static md:z-auto max-md:fixed max-md:inset-y-0 max-md:left-0">
        <Sidebar
          collapsed={collapsed}
          onToggle={toggle}
          projects={filteredProjects}
          activeProjectId={activeProjectId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onProjectClick={setActiveProjectId}
          onNewProject={openCreate}
          onRenameProject={openRename}
          onDeleteProject={openDelete}
          onDuplicateProject={handleDuplicate}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <EditorNavbar />
        <main className="relative flex flex-1 flex-col overflow-hidden">
          {isWorkspaceRoute ? (
            children
          ) : (
            <>
              {activeProject ? <EditorCanvas /> : (
                <EditorHome
                  projects={projects}
                  loading={loading}
                  onNewProject={openCreate}
                  onProjectClick={setActiveProjectId}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Dialogs */}
      <CreateProjectDialog
        open={dialogType === "create"}
        onClose={close}
        onCreate={handleCreate}
      />
      <RenameProjectDialog
        open={dialogType === "rename"}
        project={targetProject}
        onClose={close}
        onRename={handleRename}
      />
      <DeleteProjectDialog
        open={dialogType === "delete"}
        project={targetProject}
        onClose={close}
        onDelete={handleDelete}
      />

      {/* Toast container */}
      <Toaster position="bottom-right" />
    </div>
  );
}
