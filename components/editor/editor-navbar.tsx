"use client";

import { useState, useRef, useEffect } from "react";
import {
  PanelLeftOpen,
  PanelLeftClose,
  ChevronRight,
  Minus,
  Plus,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";


interface EditorNavbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function EditorNavbar({
  isSidebarOpen,
  onToggleSidebar,
}: EditorNavbarProps) {
  const [projectName, setProjectName] = useState("Untitled Project");
  const [isEditing, setIsEditing] = useState(false);
  const [zoom, setZoom] = useState(100);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function handleNameSubmit() {
    setIsEditing(false);
    if (!projectName.trim()) {
      setProjectName("Untitled Project");
    }
  }

  return (
    <nav className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-3">
      {/* Left section */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggleSidebar}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </Button>

        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-[var(--text-muted)]">Projects</span>
          <ChevronRight className="h-3 w-3 text-[var(--text-muted)]" />
          <span className="text-[var(--text-primary)]">{projectName}</span>
        </div>
      </div>

      {/* Center section — inline editable project name */}
      <div className="absolute left-1/2 -translate-x-1/2">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            aria-label="Project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSubmit();
              if (e.key === "Escape") {
                setIsEditing(false);
              }
            }}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] px-2 py-0.5 text-center text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-md px-2 py-0.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
          >
            {projectName}
          </button>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 rounded-lg bg-[var(--bg-surface-raised)] p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.max(25, z - 10))}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[3rem] text-center text-xs text-[var(--text-secondary)]">
            {zoom}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <div className="mx-0.5 h-4 w-px bg-[var(--border-default)]" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom(100)}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Status dot */}
        <div className="h-2 w-2 rounded-full bg-[var(--state-success)]" />

        {/* Avatar placeholder */}
        <div className="h-8 w-8 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)]" />
      </div>
    </nav>
  );
}
