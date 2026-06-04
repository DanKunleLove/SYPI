"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronsLeft,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  ChevronDown,
  ChevronRight,
  PanelLeftOpen,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/mock-projects";

const SIDEBAR_KEY = "spi-sidebar-collapsed";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  ownedProjects: Project[];
  sharedProjects: Project[];
  activeProjectId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onProjectClick: (id: string) => void;
  onNewProject: () => void;
  onRenameProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onDuplicateProject: (id: string) => void;
}

export function Sidebar({
  collapsed,
  onToggle,
  ownedProjects,
  sharedProjects,
  activeProjectId,
  searchQuery,
  onSearchChange,
  onProjectClick,
  onNewProject,
  onRenameProject,
  onDeleteProject,
  onDuplicateProject,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [isRecentExpanded, setIsRecentExpanded] = useState(true);
  const [isSharedExpanded, setIsSharedExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);
  const profileContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const isHome = pathname === "/dashboard";

  const handleProfileClick = useCallback(() => {
    if (!profileContainerRef.current) return;
    const clerkButton = profileContainerRef.current.querySelector(
      "button.cl-userButtonTrigger"
    );
    if (clerkButton instanceof HTMLElement) {
      clerkButton.click();
    } else {
      const anyButton = profileContainerRef.current.querySelector("button");
      if (anyButton instanceof HTMLElement) {
        anyButton.click();
      }
    }
  }, []);

  const handleHomeClick = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  const renderProjectItem = (project: Project) => {
    const isActive = project.id === activeProjectId;
    const isHovered = project.id === hoveredProjectId;
    return (
      <div
        key={project.id}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer",
          isActive
            ? "bg-[var(--bg-surface-raised)] text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]/60 hover:text-[var(--text-primary)]"
        )}
        onClick={() => onProjectClick(project.id)}
        onMouseEnter={() => setHoveredProjectId(project.id)}
        onMouseLeave={() => setHoveredProjectId(null)}
      >
        {/* Active indicator bar */}
        {isActive && (
          <motion.div
            layoutId="project-active"
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--accent-primary)]"
            transition={{ duration: 0.15, ease: "easeOut" }}
          />
        )}

        {/* Color dot */}
        <div
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: project.color }}
        />

        {/* Name */}
        <span className="flex-1 truncate text-[13px]">{project.name}</span>

        {/* Context menu */}
        <div
          className={cn(
            "shrink-0 transition-opacity",
            isHovered || isActive ? "opacity-100" : "opacity-0"
          )}
        >
          <ProjectContextMenu
            project={project}
            onRename={onRenameProject}
            onDelete={onDeleteProject}
            onDuplicate={onDuplicateProject}
          />
        </div>
      </div>
    );
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 260 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--border-default)] bg-[var(--bg-surface)]"
    >
      {/* Header — Logo + collapse */}
      <div className={cn(
        "flex h-14 items-center shrink-0",
        collapsed ? "justify-center px-2" : "justify-between px-4"
      )}>
        <button
          onClick={collapsed ? onToggle : handleHomeClick}
          title={collapsed ? "Expand sidebar" : "Home"}
          className="flex items-center gap-2.5 overflow-hidden select-none group"
        >
          <Logo showText={!collapsed} />
        </button>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
            aria-label="Collapse sidebar"
            onClick={onToggle}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* New Project button */}
      <div className={cn("pb-2 shrink-0", collapsed ? "px-2" : "px-3")}>
        <Button
          className={cn(
            "w-full border border-dashed border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5",
            collapsed ? "justify-center px-0" : "gap-2"
          )}
          variant="ghost"
          onClick={onNewProject}
          title={collapsed ? "New Project" : undefined}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-sm">New Project</span>}
        </Button>
      </div>

      {/* Search — only when expanded */}
      {!collapsed && (
        <div className="px-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 pl-8 text-xs bg-[var(--bg-base)] border-[var(--border-default)]"
            />
          </div>
        </div>
      )}

      {/* Project lists — only when expanded */}
      {!collapsed && (
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1 pb-2">
            {/* Recent / My Projects */}
            <div>
              <button
                type="button"
                onClick={() => setIsRecentExpanded(!isRecentExpanded)}
                className="flex w-full items-center justify-between px-2 py-1.5 hover:text-[var(--text-primary)] transition-colors select-none text-[var(--text-muted)]"
              >
                <div className="flex items-center gap-1.5">
                  {isRecentExpanded ? (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  )}
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Recent
                  </span>
                </div>
                <span className="text-[10px] font-medium tabular-nums text-[var(--text-muted)] bg-[var(--bg-surface-raised)] px-1.5 py-0.5 rounded">
                  {ownedProjects.length}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isRecentExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeInOut" }}
                    className="overflow-hidden space-y-0.5 pl-1"
                  >
                    {ownedProjects.length === 0 ? (
                      <p className="px-2 py-2 text-[12px] text-[var(--text-muted)]">
                        {searchQuery ? "No matches" : "No projects yet"}
                      </p>
                    ) : (
                      ownedProjects.map(renderProjectItem)
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Shared with Me */}
            <div>
              <button
                type="button"
                onClick={() => setIsSharedExpanded(!isSharedExpanded)}
                className="flex w-full items-center justify-between px-2 py-1.5 hover:text-[var(--text-primary)] transition-colors select-none text-[var(--text-muted)]"
              >
                <div className="flex items-center gap-1.5">
                  {isSharedExpanded ? (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  )}
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Shared with Me
                  </span>
                </div>
                <span className="text-[10px] font-medium tabular-nums text-[var(--text-muted)] bg-[var(--bg-surface-raised)] px-1.5 py-0.5 rounded">
                  {sharedProjects.length}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isSharedExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeInOut" }}
                    className="overflow-hidden space-y-0.5 pl-1"
                  >
                    {sharedProjects.length === 0 ? (
                      <p className="px-2 py-2 text-[12px] text-[var(--text-muted)]">
                        {searchQuery ? "No matches" : "None shared"}
                      </p>
                    ) : (
                      sharedProjects.map(renderProjectItem)
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Spacer when collapsed */}
      {collapsed && <div className="flex-1" />}

      {/* User profile area */}
      <div
        ref={profileContainerRef}
        onClick={handleProfileClick}
        title={collapsed ? "Profile" : undefined}
        className={cn(
          "group border-t border-[var(--border-default)] cursor-pointer transition-colors duration-150 hover:bg-[var(--bg-surface-raised)]/60 select-none shrink-0",
          collapsed ? "px-2 py-3" : "px-3 py-3"
        )}
      >
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "gap-2.5"
        )}>
          <div className="shrink-0 pointer-events-none">
            {mounted && (
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: collapsed ? "h-7 w-7" : "h-8 w-8",
                  },
                }}
              />
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate text-[13px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-hover)]">
                Profile
              </span>
              <span className="truncate text-[11px] text-[var(--text-muted)]">
                Manage account
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

/** Three-dot context menu for a project item */
function ProjectContextMenu({
  project,
  onRename,
  onDelete,
  onDuplicate,
}: {
  project: Project;
  onRename: (project: Project) => void;
  onDelete: (project: Project) => void;
  onDuplicate: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)]"
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={8}>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onRename(project);
          }}
        >
          <Pencil className="h-4 w-4" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(project.id);
          }}
        >
          <Copy className="h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-[var(--state-error)] focus:text-[var(--state-error)]"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(project);
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Hook: sidebar collapsed state persisted in localStorage */
export function useSidebarState() {
  // Start with false (expanded) for SSR consistency — sync from localStorage after mount
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Read stored state after mount to avoid hydration mismatch
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "true") {
      setCollapsed(true);
    } else if (window.matchMedia("(max-width: 768px)").matches) {
      setCollapsed(true);
    }

    const mq = window.matchMedia("(max-width: 768px)");
    function handleChange(e: MediaQueryListEvent) {
      if (e.matches) setCollapsed(true);
    }
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
