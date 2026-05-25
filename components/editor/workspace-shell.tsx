"use client";

import { useState, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { WorkspaceNavbar } from "@/components/editor/workspace-navbar";
import { WorkspaceCanvas } from "@/components/editor/workspace-canvas";
import { AiSidebar } from "@/components/editor/ai-sidebar";
import { StatusBar } from "@/components/editor/status-bar";
import { ShareDialog } from "@/components/editor/share-dialog";
import { LiveblocksRoom } from "@/components/editor/liveblocks-room";

interface WorkspaceShellProps {
  project: {
    id: string;
    name: string;
    description: string | null;
  };
}

export function WorkspaceShell({ project }: WorkspaceShellProps) {
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const [zoom, setZoom] = useState(100);

  const handleNodeCountChange = useCallback((count: number) => {
    setNodeCount(count);
  }, []);

  const handleZoomChange = useCallback((z: number) => {
    setZoom(z);
  }, []);

  return (
    <LiveblocksRoom roomId={project.id}>
      <ReactFlowProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          {/* Top navbar */}
          <WorkspaceNavbar
            projectName={project.name}
            aiSidebarOpen={aiSidebarOpen}
            onToggleAiSidebar={() => setAiSidebarOpen((v) => !v)}
            onOpenShare={() => setShareDialogOpen(true)}
          />

          {/* Share dialog */}
          <ShareDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            projectId={project.id}
            projectName={project.name}
          />

          {/* Main workspace area */}
          <div className="flex flex-1 overflow-hidden">
            {/* Canvas */}
            <WorkspaceCanvas
              projectId={project.id}
              onNodeCountChange={handleNodeCountChange}
              onZoomChange={handleZoomChange}
            />

            {/* AI sidebar */}
            <AiSidebar open={aiSidebarOpen} />
          </div>

          {/* Status bar */}
          <StatusBar
            projectStatus="Draft"
            nodeCount={nodeCount}
            zoom={zoom}
          />
        </div>
      </ReactFlowProvider>
    </LiveblocksRoom>
  );
}
