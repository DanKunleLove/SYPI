"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const RECENT_PROJECTS = [
  { id: "1", name: "Microservices Architecture", editedAt: "2h ago" },
  { id: "2", name: "Event-Driven System", editedAt: "1d ago" },
  { id: "3", name: "API Gateway Design", editedAt: "3d ago" },
];

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  const [search, setSearch] = useState("");

  const filteredProjects = RECENT_PROJECTS.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-40 bg-black/40"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-0 top-0 z-50 flex h-full w-80 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Projects
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  placeholder="Search projects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Recent projects */}
            <div className="px-4 pb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Recent
              </span>
              <div className="mt-2 space-y-1">
                {filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-surface-raised)]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--bg-surface-raised)]">
                      <FolderOpen className="h-4 w-4 text-[var(--accent-primary)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {project.name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Edited {project.editedAt}
                      </p>
                    </div>
                    <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--state-success)]" />
                  </button>
                ))}
                {filteredProjects.length === 0 && (
                  <p className="py-2 text-center text-sm text-[var(--text-muted)]">
                    No projects found
                  </p>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex-1 overflow-hidden px-4 pt-2">
              <Tabs defaultValue="my-projects" className="flex h-full flex-col">
                <TabsList className="w-full">
                  <TabsTrigger value="my-projects" className="flex-1">
                    My Projects
                  </TabsTrigger>
                  <TabsTrigger value="shared" className="flex-1">
                    Shared
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="my-projects"
                  className="flex flex-1 items-center justify-center"
                >
                  <div className="text-center">
                    <FolderOpen className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      No projects yet
                    </p>
                  </div>
                </TabsContent>
                <TabsContent
                  value="shared"
                  className="flex flex-1 items-center justify-center"
                >
                  <div className="text-center">
                    <FolderOpen className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      Nothing shared with you
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--border-default)] p-4">
              <Button className="w-full gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
