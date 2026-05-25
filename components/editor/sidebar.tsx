"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
} from "lucide-react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/mock-projects";

const SIDEBAR_KEY = "spi-sidebar-collapsed";

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  section: "workspace" | "tools";
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "#", section: "workspace" },
  { icon: FileText, label: "Templates", href: "#", section: "tools" },
  { icon: Settings, label: "Settings", href: "#", section: "tools" },
];

import { ChevronDown, ChevronRight } from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  projects: Project[];
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
  projects,
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
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [isOwnedExpanded, setIsOwnedExpanded] = useState(true);
  const [isSharedExpanded, setIsSharedExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);

  const profileContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const sections = [
    { key: "workspace" as const, label: "WORKSPACE" },
    { key: "tools" as const, label: "TOOLS" },
  ];

  // Programmatic click-dispatcher to trigger Clerk popup on row clicks
  const handleProfileClick = useCallback(() => {
    if (!profileContainerRef.current) return;
    const clerkButton = profileContainerRef.current.querySelector("button.cl-userButtonTrigger");
    if (clerkButton instanceof HTMLElement) {
      clerkButton.click();
    } else {
      const anyButton = profileContainerRef.current.querySelector("button");
      if (anyButton instanceof HTMLElement) {
        anyButton.click();
      }
    }
  }, []);

  const renderProjectItem = (project: Project) => {
    const isActive = project.id === activeProjectId;
    const isHovered = project.id === hoveredProjectId;
    return (
      <div
        key={project.id}
        className={cn(
          "group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer",
          isActive
            ? "bg-[var(--bg-surface-raised)] text-[var(--text-primary)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
        )}
        onClick={() => onProjectClick(project.id)}
        onMouseEnter={() => setHoveredProjectId(project.id)}
        onMouseLeave={() => setHoveredProjectId(null)}
      >
        {/* Active indicator bar */}
        {isActive && (
          <motion.div
            layoutId="project-active"
            className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--accent-primary)]"
            transition={{ duration: 0.15, ease: "easeOut" }}
          />
        )}

        {/* Color dot */}
        <div
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: project.color }}
        />

        {/* Name */}
        <span className="flex-1 truncate text-xs">
          {project.name}
        </span>

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
      animate={{ width: collapsed ? 48 : 240 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex h-full shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)]"
    >
      {/* Logo and Collapse Top area */}
      <div
        className={cn(
          "flex h-12 items-center border-b border-[var(--border-default)] px-3 justify-between",
          collapsed && "justify-center cursor-pointer"
        )}
        onClick={collapsed ? onToggle : undefined}
        title={collapsed ? "Expand sidebar" : undefined}
      >
        <div className="flex items-center gap-2 overflow-hidden select-none">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]">
            <span className="text-xs font-bold text-white">S</span>
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.15 }}
              className="whitespace-nowrap text-sm font-semibold text-[var(--text-primary)]"
            >
              spi AI
            </motion.span>
          )}
        </div>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
            aria-label="Collapse sidebar"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* New Project button */}
      <div className="px-2 pt-3 pb-1">
        <Button
          variant="ghost"
          className={cn(
            "w-full gap-2 border border-dashed border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]",
            collapsed && "justify-center px-0"
          )}
          aria-label="New Project"
          title={collapsed ? "New Project" : undefined}
          onClick={onNewProject}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-sm">New Project</span>}
        </Button>
      </div>

      {/* Projects section — only when expanded */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col overflow-hidden border-b border-[var(--border-default)]"
          >
            {/* Search */}
            <div className="px-2 pt-2 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>

            {/* Scrollable list area */}
            <ScrollArea className="max-h-64">
              <div className="px-2 pb-2 space-y-3">
                {/* 1. Owned Projects Folder */}
                <div>
                  <button
                    type="button"
                    onClick={() => setIsOwnedExpanded(!isOwnedExpanded)}
                    className="flex w-full items-center justify-between px-1 py-1 hover:text-[var(--text-primary)] transition-colors select-none text-[var(--text-muted)]"
                  >
                    <div className="flex items-center gap-1">
                      {isOwnedExpanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        My Projects
                      </span>
                    </div>
                    <span className="text-[9px] font-semibold bg-[var(--bg-surface-raised)] text-[var(--text-muted)] px-1 rounded">
                      {ownedProjects.length}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOwnedExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeInOut" }}
                        className="overflow-hidden mt-1 pl-1 space-y-0.5"
                      >
                        {ownedProjects.length === 0 ? (
                          <p className="px-2 py-1.5 text-left text-[11px] text-[var(--text-muted)]">
                            {searchQuery ? "No matches" : "No owned projects"}
                          </p>
                        ) : (
                          ownedProjects.map(renderProjectItem)
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 2. Shared Projects Folder */}
                <div>
                  <button
                    type="button"
                    onClick={() => setIsSharedExpanded(!isSharedExpanded)}
                    className="flex w-full items-center justify-between px-1 py-1 hover:text-[var(--text-primary)] transition-colors select-none text-[var(--text-muted)]"
                  >
                    <div className="flex items-center gap-1">
                      {isSharedExpanded ? (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0" />
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Shared with Me
                      </span>
                    </div>
                    <span className="text-[9px] font-semibold bg-[var(--bg-surface-raised)] text-[var(--text-muted)] px-1 rounded">
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
                        className="overflow-hidden mt-1 pl-1 space-y-0.5"
                      >
                        {sharedProjects.length === 0 ? (
                          <p className="px-2 py-1.5 text-left text-[11px] text-[var(--text-muted)]">
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation with section labels */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {sections.map((section) => {
          const items = NAV_ITEMS.filter((i) => i.section === section.key);
          if (items.length === 0) return null;

          return (
            <div key={section.key} className="mb-3">
              {!collapsed && (
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = item.label === activeNav;
                  return (
                    <Button
                      key={item.label}
                      variant="ghost"
                      className={cn(
                        "relative w-full justify-start gap-3 text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]",
                        collapsed && "justify-center px-0",
                        isActive &&
                          "bg-[var(--bg-surface-raised)] text-[var(--text-primary)]"
                      )}
                      aria-label={item.label}
                      title={collapsed ? item.label : undefined}
                      onClick={() => {
                        if (item.label === "Templates" || item.label === "Settings") {
                          toast(`${item.label} coming soon`, {
                            description: `${item.label} will be available in a future update.`,
                            duration: 3000,
                          });
                          return;
                        }
                        setActiveNav(item.label);
                      }}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--accent-primary)]"
                          transition={{ duration: 0.15, ease: "easeOut" }}
                        />
                      )}
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="truncate text-sm">{item.label}</span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User area - Entire row clickable */}
      <div
        ref={profileContainerRef}
        onClick={handleProfileClick}
        title={collapsed ? "Manage Profile" : undefined}
        className={cn(
          "group border-t border-[var(--border-default)] px-2 py-2.5 cursor-pointer transition-colors duration-150 hover:bg-[var(--bg-surface-raised)]/60 select-none",
          collapsed && "py-3"
        )}
      >
        <div className={cn("flex items-center", collapsed ? "justify-center" : "px-1 gap-2.5")}>
          <div className="shrink-0 pointer-events-none">
            {mounted && (
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-7 w-7",
                  },
                }}
              />
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden items-start">
              <span className="truncate text-xs font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-hover)] text-left w-full">
                Active Account
              </span>
              <span className="truncate text-[10px] text-[var(--text-muted)] text-left w-full">
                Profile & Settings
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle with keyboard hint */}
      <div className="border-t border-[var(--border-default)] px-2 py-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-full text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            collapsed && "w-8"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggle}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <div className="flex w-full items-center justify-between px-1">
              <ChevronsLeft className="h-4 w-4" />
              <kbd className="rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                [
              </kbd>
            </div>
          )}
        </Button>
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
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
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
          variant="destructive"
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

/** Read sidebar collapsed state from localStorage */
export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "true") return true;
    return window.matchMedia("(max-width: 768px)").matches;
  });

  useEffect(() => {
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
