"use client";

import { Box, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useStatus } from "@liveblocks/react";

interface StatusBarProps {
  projectStatus?: string;
  nodeCount?: number;
  zoom?: number;
}

function ConnectionIndicator() {
  const status = useStatus();

  if (status === "connected") {
    return (
      <div className="flex items-center gap-1">
        <Wifi className="h-3 w-3 text-[var(--state-success)]" />
        <span>Connected</span>
      </div>
    );
  }

  if (status === "reconnecting") {
    return (
      <div className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin text-[var(--state-warning,#eab308)]" />
        <span>Reconnecting...</span>
      </div>
    );
  }

  // disconnected or initial
  return (
    <div className="flex items-center gap-1">
      <WifiOff className="h-3 w-3 text-[var(--state-error,#ef4444)]" />
      <span>Disconnected</span>
    </div>
  );
}

export function StatusBar({
  projectStatus = "Draft",
  nodeCount = 0,
  zoom = 100,
}: StatusBarProps) {
  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-[11px] text-[var(--text-muted)]">
      {/* Left — project status */}
      <div className="flex items-center gap-2">
        <span className="rounded bg-[var(--bg-surface-raised)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">
          {projectStatus}
        </span>
      </div>

      {/* Center — node count */}
      <div className="flex items-center gap-1">
        <Box className="h-3 w-3" />
        <span>
          {nodeCount} node{nodeCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Right — zoom + connection */}
      <div className="flex items-center gap-3">
        <span>{zoom}%</span>
        <ConnectionIndicator />
      </div>
    </div>
  );
}
