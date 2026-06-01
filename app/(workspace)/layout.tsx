"use client";

import { useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar, useSidebarState } from "@/components/workspace/sidebar";
import { CreateProjectDialog } from "@/components/editor/create-project-dialog";
import { RenameProjectDialog } from "@/components/editor/rename-project-dialog";
import { DeleteProjectDialog } from "@/components/editor/delete-project-dialog";
import { useProjects } from "@/hooks/use-projects";
import { useProjectDialogs } from "@/hooks/use-project-dialogs";
import { useCreateProjectListener } from "@/hooks/use-create-project-event";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { collapsed, toggle } = useSidebarState();
  const router = useRouter();
  const pathname = usePathname();

  const {
    projects,
    ownedProjects,
    sharedProjects,
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

  // Sync activeProjectId with URL
  useEffect(() => {
    const match = pathname.match(/^\/([^\/]+)$/);
    if (match && match[1] !== "") {
      const projectId = match[1];
      if (activeProjectId !== projectId) {
        setActiveProjectId(projectId);
      }
    } else if (pathname === "/") {
      setActiveProjectId(null);
    }
  }, [pathname, activeProjectId, setActiveProjectId]);

  // Navigate to project
  const handleProjectClick = useCallback(
    (id: string) => {
      setActiveProjectId(id);
      router.push(`/${id}`);
    },
    [setActiveProjectId, router]
  );

  // Filter projects by search query
  const filteredOwned = useMemo(() => {
    if (!searchQuery.trim()) return ownedProjects;
    const q = searchQuery.toLowerCase();
    return ownedProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [ownedProjects, searchQuery]);

  const filteredShared = useMemo(() => {
    if (!searchQuery.trim()) return sharedProjects;
    const q = searchQuery.toLowerCase();
    return sharedProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [sharedProjects, searchQuery]);

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

  // Listen for "create project" events dispatched from child pages
  useEffect(() => {
    const cleanup = useCreateProjectListener(openCreate);
    return cleanup;
  }, [openCreate]);

  const handleCreate = useCallback(
    async (data: { name: string; description: string; template: string }) => {
      try {
        const project = await addProject(data);
        if (project) {
          toast.success("Project created", {
            description: `"${project.name}" is ready.`,
            duration: 3000,
          });
          router.push(`/${project.id}`);
        } else {
          toast.error("Failed to create project", {
            description: "Please try again.",
            duration: 4000,
          });
        }
      } catch (error) {
        toast.error("Failed to create project", {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
          duration: 4000,
        });
      }
    },
    [addProject, router]
  );

  const handleRename = useCallback(
    async (id: string, newName: string) => {
      try {
        const ok = await renameProject(id, newName);
        if (ok) {
          toast.success("Project renamed", { duration: 3000 });
          // The canvas header reads the project name from the server-rendered
          // page, so refresh it to reflect the new name (sidebar already updated).
          router.refresh();
        } else {
          toast.error("Failed to rename project", {
            description: "Please try again.",
            duration: 4000,
          });
        }
      } catch (error) {
        toast.error("Failed to rename project", {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
          duration: 4000,
        });
      }
    },
    [renameProject, router]
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
          router.push("/");
        } else {
          toast.error("Failed to delete project", {
            description: "Please try again.",
            duration: 4000,
          });
        }
      } catch (error) {
        toast.error("Failed to delete project", {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred.",
          duration: 4000,
        });
      }
    },
    [deleteProject, router]
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      const copy = await duplicateProject(id);
      if (copy) {
        toast.success("Project duplicated", {
          description: `"${copy.name}" created.`,
          duration: 3000,
        });
        router.push(`/${copy.id}`);
      } else {
        toast.error("Failed to duplicate project", {
          description: "Please try again.",
          duration: 4000,
        });
      }
    },
    [duplicateProject, router]
  );

  // Mobile overlay state
  const isMobileOpen = !collapsed;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)]">
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

      {/* Sidebar */}
      <div className="z-50 md:static md:z-auto max-md:fixed max-md:inset-y-0 max-md:left-0">
        <Sidebar
          collapsed={collapsed}
          onToggle={toggle}
          ownedProjects={filteredOwned}
          sharedProjects={filteredShared}
          activeProjectId={activeProjectId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onProjectClick={handleProjectClick}
          onNewProject={openCreate}
          onRenameProject={openRename}
          onDeleteProject={openDelete}
          onDuplicateProject={handleDuplicate}
        />
      </div>

      {/* Main content — children switch between home and canvas */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
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

      <Toaster position="bottom-right" />
    </div>
  );
}
