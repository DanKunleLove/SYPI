"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar";
import { ProjectGrid } from "@/components/dashboard/project-grid";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import {
  createProject,
  renameProject,
  duplicateProject,
  deleteProject,
} from "@/lib/actions/project";
import type { ProjectCardData } from "@/components/dashboard/project-card";
import { toast } from "sonner";

export function DashboardClient({
  myProjects: initialMyProjects,
  sharedProjects: initialSharedProjects,
}: {
  myProjects: ProjectCardData[];
  sharedProjects: ProjectCardData[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"my" | "shared">("my");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
    router.push(`/editor/${id}`);
  }

  function handleRename(id: string) {
    const name = prompt("New name:");
    if (!name?.trim()) return;
    startTransition(async () => {
      try {
        await renameProject(id, name);
        router.refresh();
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
    if (!confirm("Delete this project? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteProject(id);
        router.refresh();
        toast.success("Project deleted");
      } catch {
        toast.error("Failed to delete project");
      }
    });
  }

  function handleShare(id: string) {
    router.push(`/editor/${id}?share=true`);
  }

  async function handleCreate(data: { name: string; description: string }) {
    const project = await createProject(data);
    router.push(`/editor/${project.id}`);
  }

  return (
    <>
      <DashboardNavbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
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
              onClick={() => setCreateOpen(true)}
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
              onCreateProject={() => setCreateOpen(true)}
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
        </div>
      </div>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />
    </>
  );
}
