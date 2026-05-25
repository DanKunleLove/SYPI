"use client";

import { ArrowLeft, ChevronRight, Users, PanelRightOpen, PanelRightClose } from "lucide-react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Button, buttonVariants } from "@/components/ui/button";

interface WorkspaceNavbarProps {
  projectName: string;
  aiSidebarOpen: boolean;
  onToggleAiSidebar: () => void;
  onOpenShare: () => void;
}

export function WorkspaceNavbar({
  projectName,
  aiSidebarOpen,
  onToggleAiSidebar,
  onOpenShare,
}: WorkspaceNavbarProps) {
  return (
    <nav className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3">
      {/* Left — back + breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/"
          aria-label="Back to projects"
          className={buttonVariants({ variant: "ghost", size: "icon", className: "h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-[var(--text-muted)]">Projects</span>
        <ChevronRight className="h-3 w-3 text-[var(--text-muted)]" />
        <span className="max-w-[200px] truncate font-medium text-[var(--text-primary)]">
          {projectName}
        </span>
      </div>

      {/* Center — project name */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {projectName}
        </span>
      </div>

      {/* Right — presence + actions */}
      <div className="flex items-center gap-3">
        {/* Presence avatar stack (placeholder) */}
        <div className="flex items-center gap-1.5" title="Just you">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-6 w-6",
              },
            }}
          />
          <span className="hidden text-xs text-[var(--text-muted)] sm:inline">
            Just you
          </span>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-[var(--border-default)]" />

        {/* Share button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Share"
          onClick={onOpenShare}
        >
          <Users className="h-4 w-4" />
        </Button>

        {/* AI sidebar toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[var(--accent-ai)]"
          aria-label={aiSidebarOpen ? "Close AI panel" : "Open AI panel"}
          onClick={onToggleAiSidebar}
        >
          {aiSidebarOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </Button>

        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-[var(--state-success)]" />
        </div>
      </div>
    </nav>
  );
}
