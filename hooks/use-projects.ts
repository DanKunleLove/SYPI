"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { PROJECT_COLORS, slugify, type Project } from "@/lib/mock-projects";

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
      const mapped = (data.projects as ApiProject[]).map(toUiProject);
      setProjects(mapped);
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
    async (data: { name: string; description: string }): Promise<Project | null> => {
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
      setActiveProjectId(apiProject.id);
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

      setProjects((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, name: newName, slug: slugify(newName) } : p
        )
      );
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
      setActiveProjectId((prev) => (prev === id ? null : prev));
      return target;
    },
    []
  );

  const duplicateProject = useCallback(
    async (id: string): Promise<Project | null> => {
      // Read current state synchronously via a temporary variable
      let original: Project | null = null;
      setProjects((prev) => {
        original = prev.find((p) => p.id === id) ?? null;
        return prev; // no mutation, just reading
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
      return copy;
    },
    []
  );

  return {
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
  };
}
