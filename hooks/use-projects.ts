"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { PROJECT_COLORS, slugify, type Project } from "@/lib/mock-projects";
import { getSystemTemplate } from "@/lib/system-templates";

interface ApiProject {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  canvasJsonPath: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Map API response to UI Project shape */
function toUiProject(api: ApiProject, index: number): Project {
  return {
    id: api.id,
    name: api.name,
    slug: slugify(api.name),
    description: api.description ?? "",
    nodeCount: 0, // Canvas nodes come from Liveblocks later
    lastEdited: new Date(api.updatedAt),
    color: PROJECT_COLORS[index % PROJECT_COLORS.length],
    template: "blank",
  };
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [ownedProjects, setOwnedProjects] = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) {
        console.error("Failed to fetch projects:", res.status);
        return;
      }
      const data = await res.json();
      const mappedOwned = (data.owned as ApiProject[] ?? []).map((p, i) => toUiProject(p, i));
      const mappedShared = (data.shared as ApiProject[] ?? []).map((p, i) => toUiProject(p, i + 100)); // offset colors
      
      setOwnedProjects(mappedOwned);
      setSharedProjects(mappedShared);
      setProjects([...mappedOwned, ...mappedShared]);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );

  const addProject = useCallback(
    async (data: { name: string; description: string; template?: string }): Promise<Project | null> => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, description: data.description }),
      });

      if (!res.ok) return null;

      const { project: apiProject } = await res.json();
      let project: Project | null = null;

      setProjects((prev) => {
        project = toUiProject(apiProject, prev.length);
        return [project, ...prev];
      });
      setOwnedProjects((prev) => {
        if (!project) return prev;
        return [project, ...prev];
      });

      setActiveProjectId(apiProject.id);

      // Load system template canvas data onto the new project
      if (data.template && data.template !== "blank") {
        const templateCanvas = getSystemTemplate(data.template);
        if (templateCanvas) {
          fetch(`/api/projects/${apiProject.id}/canvas`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(templateCanvas),
          }).catch(() => {
            // Non-fatal: canvas will just start empty
          });
        }
      }

      return project;
    },
    []
  );

  const renameProject = useCallback(
    async (id: string, newName: string): Promise<boolean> => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (!res.ok) return false;

      const updateName = (p: Project) =>
        p.id === id ? { ...p, name: newName, slug: slugify(newName) } : p;

      setProjects((prev) => prev.map(updateName));
      setOwnedProjects((prev) => prev.map(updateName));
      setSharedProjects((prev) => prev.map(updateName));
      return true;
    },
    []
  );

  const deleteProject = useCallback(
    async (id: string): Promise<Project | null> => {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) return null;

      let target: Project | null = null;
      
      setProjects((prev) => {
        target = prev.find((p) => p.id === id) ?? null;
        return prev.filter((p) => p.id !== id);
      });
      setOwnedProjects((prev) => prev.filter((p) => p.id !== id));
      setSharedProjects((prev) => prev.filter((p) => p.id !== id));
      
      setActiveProjectId((prev) => (prev === id ? null : prev));
      return target;
    },
    []
  );

  const duplicateProject = useCallback(
    async (id: string): Promise<Project | null> => {
      let original: Project | null = null;
      setProjects((prev) => {
        original = prev.find((p) => p.id === id) ?? null;
        return prev;
      });
      if (!original) return null;

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${(original as Project).name} (Copy)`,
          description: (original as Project).description,
        }),
      });

      if (!res.ok) return null;

      const { project: apiProject } = await res.json();
      let copy: Project | null = null;
      
      setProjects((prev) => {
        copy = toUiProject(apiProject, prev.length);
        const idx = prev.findIndex((p) => p.id === id);
        const next = [...prev];
        next.splice(idx + 1, 0, copy);
        return next;
      });
      setOwnedProjects((prev) => {
        if (!copy) return prev;
        const idx = prev.findIndex((p) => p.id === id);
        const next = [...prev];
        if (idx === -1) {
          return [copy, ...prev];
        }
        next.splice(idx + 1, 0, copy);
        return next;
      });
      
      return copy;
    },
    []
  );

  return {
    projects,
    ownedProjects,
    sharedProjects,
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
  };
}
