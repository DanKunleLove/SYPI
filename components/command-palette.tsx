"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useTheme } from "next-themes";
import {
  Search,
  Plus,
  LayoutGrid,
  Sparkles,
  Package,
  ShieldCheck,
  MessageSquare,
  Share2,
  Save,
  Settings,
  Users,
  HelpCircle,
  MessageSquareHeart,
  SunMoon,
  GitBranch,
} from "lucide-react";
import { openFeedback } from "@/components/feedback/feedback-widget";
import { recordEvent } from "@/lib/events";
import type { Project } from "@/lib/mock-projects";

/** Workspace-scoped palette actions, handled by ProjectWorkspace via window event. */
export type WorkspaceCommand = "ai" | "spec" | "review" | "comments" | "share" | "save";

export function dispatchWorkspaceCommand(action: WorkspaceCommand) {
  window.dispatchEvent(new CustomEvent("spi:workspace-command", { detail: { action } }));
}

interface CommandPaletteProps {
  projects: Project[];
  activeProjectId: string | null;
  onNewProject: () => void;
  onHelp: () => void;
}

/**
 * Global command palette (Ctrl/⌘K) — Linear-style: search projects and run any
 * action from anywhere. Canvas actions appear only inside a project.
 */
export function CommandPalette({
  projects,
  activeProjectId,
  onNewProject,
  onHelp,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const run = useCallback((id: string, fn: () => void) => {
    setOpen(false);
    recordEvent("palette_used", { action: id });
    fn();
  }, []);

  if (!open) return null;

  const inCanvas = activeProjectId !== null;

  const itemClass =
    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--text-secondary)] data-[selected=true]:bg-[var(--bg-surface-raised)] data-[selected=true]:text-[var(--text-primary)]";
  const groupClass =
    "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-[var(--text-muted)]";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-[14vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command loop>
          <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-3">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            <Command.Input
              autoFocus
              placeholder="Search projects or type a command…"
              className="h-11 w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <kbd className="rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
              Esc
            </kbd>
          </div>

          <Command.List className="max-h-[50vh] overflow-y-auto p-1.5">
            <Command.Empty className="px-2.5 py-6 text-center text-xs text-[var(--text-muted)]">
              No results — try a project name or an action.
            </Command.Empty>

            {inCanvas && (
              <Command.Group heading="This canvas" className={groupClass}>
                <Command.Item className={itemClass} onSelect={() => run("ai", () => dispatchWorkspaceCommand("ai"))}>
                  <Sparkles className="h-4 w-4 text-[var(--accent-ai)]" /> Open AI Twin — generate or refine
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => run("spec", () => dispatchWorkspaceCommand("spec"))}>
                  <Package className="h-4 w-4 text-[var(--accent-ai)]" /> Generate System Kit / export
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => run("review", () => dispatchWorkspaceCommand("review"))}>
                  <ShieldCheck className="h-4 w-4" /> Review design (AI critique)
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => run("comments", () => dispatchWorkspaceCommand("comments"))}>
                  <MessageSquare className="h-4 w-4" /> Comments & team chat
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => run("share", () => dispatchWorkspaceCommand("share"))}>
                  <Share2 className="h-4 w-4" /> Share & invite
                </Command.Item>
                <Command.Item className={itemClass} onSelect={() => run("save", () => dispatchWorkspaceCommand("save"))}>
                  <Save className="h-4 w-4" /> Save canvas
                </Command.Item>
              </Command.Group>
            )}

            <Command.Group heading="Go to" className={groupClass}>
              <Command.Item className={itemClass} onSelect={() => run("new-project", onNewProject)}>
                <Plus className="h-4 w-4" /> New project
              </Command.Item>
              <Command.Item className={itemClass} onSelect={() => run("dashboard", () => router.push("/dashboard"))}>
                <LayoutGrid className="h-4 w-4" /> Dashboard
              </Command.Item>
              <Command.Item className={itemClass} onSelect={() => run("settings", () => router.push("/settings"))}>
                <Settings className="h-4 w-4" /> AI settings — keys & instructions
              </Command.Item>
              <Command.Item className={itemClass} onSelect={() => run("team", () => router.push("/team"))}>
                <Users className="h-4 w-4" /> Team
              </Command.Item>
            </Command.Group>

            {projects.length > 0 && (
              <Command.Group heading="Projects" className={groupClass}>
                {projects.slice(0, 30).map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`project ${p.name}`}
                    className={itemClass}
                    onSelect={() => run("open-project", () => router.push(`/${p.id}`))}
                  >
                    <GitBranch className="h-4 w-4" /> {p.name}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Help & app" className={groupClass}>
              <Command.Item className={itemClass} onSelect={() => run("help", onHelp)}>
                <HelpCircle className="h-4 w-4" /> Help & shortcuts
              </Command.Item>
              <Command.Item className={itemClass} onSelect={() => run("feedback", openFeedback)}>
                <MessageSquareHeart className="h-4 w-4" /> Send feedback
              </Command.Item>
              <Command.Item
                className={itemClass}
                onSelect={() =>
                  run("theme", () => setTheme(resolvedTheme === "dark" ? "light" : "dark"))
                }
              >
                <SunMoon className="h-4 w-4" /> Toggle light / dark theme
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
