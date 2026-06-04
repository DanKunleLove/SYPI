"use client";

import {
  ChevronRight,
  Users,
  Download,
  Sparkles,
  Shield,
  Box,
  PanelLeftOpen,
  Save,
  Check,
  Loader2,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { SaveStatus } from "@/hooks/use-canvas-autosave";

interface WorkspaceToolbarProps {
  projectName: string;
  nodeCount: number;
  zoom: number;
  sidebarCollapsed: boolean;
  saveStatus: SaveStatus;
  onToggleSidebar: () => void;
  onOpenShare: () => void;
  onToggleAiPanel: () => void;
  onToggleCritique: () => void;
  onToggleComments: () => void;
  onManualSave: () => void;
  onExport: () => void;
}

export function WorkspaceToolbar({
  projectName,
  nodeCount,
  zoom,
  sidebarCollapsed,
  saveStatus,
  onToggleSidebar,
  onOpenShare,
  onToggleAiPanel,
  onToggleCritique,
  onToggleComments,
  onManualSave,
  onExport,
}: WorkspaceToolbarProps) {
  return (
    <nav className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3 gap-2">
      {/* Left section — sidebar toggle + breadcrumb */}
      <div className="flex items-center gap-2 text-sm min-w-0">
        {sidebarCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="Open sidebar"
            onClick={onToggleSidebar}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}
        <Link
          href="/"
          className="text-[var(--text-muted)] shrink-0 rounded px-1 transition-colors hover:text-[var(--text-primary)] hover:underline"
        >
          Projects
        </Link>
        <ChevronRight className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
        <span className="truncate font-medium text-[var(--text-primary)]">
          {projectName}
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Zoom */}
        <div className="hidden sm:flex items-center gap-0.5 rounded-lg bg-[var(--bg-surface-raised)] p-0.5">
          <span className="min-w-[2.5rem] text-center text-xs text-[var(--text-secondary)]">
            {zoom}%
          </span>
        </div>

        {/* Node count */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-[var(--bg-surface-raised)] px-2 py-1">
          <Box className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-secondary)]">
            {nodeCount} node{nodeCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Manual Save */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Save"
          title="Save (Ctrl+S)"
          onClick={onManualSave}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
          ) : saveStatus === "saved" ? (
            <Check className="h-4 w-4 text-[var(--state-success)]" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>

        {/* Comments */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Comments"
          title="Comments"
          onClick={onToggleComments}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>

        {/* Share */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Share"
          onClick={onOpenShare}
        >
          <Users className="h-4 w-4" />
        </Button>

        {/* Export — opens the AI panel's Spec tab */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Export spec"
          title="Export spec"
          onClick={onExport}
        >
          <Download className="h-4 w-4" />
        </Button>

        {/* Review — opens critique panel */}
        <Button
          variant="ghost"
          className="gap-1.5 px-2.5"
          aria-label="Review architecture"
          onClick={onToggleCritique}
        >
          <Shield className="h-4 w-4" />
          <span className="text-sm hidden sm:inline">Review</span>
        </Button>

        {/* Generate — opens AI panel */}
        <Button
          className="gap-2 bg-[var(--accent-ai)] px-3 text-white hover:bg-[var(--accent-ai)]/90"
          aria-label="Generate with AI"
          onClick={onToggleAiPanel}
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-sm hidden sm:inline">Generate</span>
        </Button>
      </div>
    </nav>
  );
}
