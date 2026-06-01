"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { WorkspaceCanvas } from "@/components/editor/workspace-canvas";
import { AiPanel } from "@/components/workspace/ai-panel";
import { NodeInspector } from "@/components/workspace/node-inspector";
import { CritiquePanel } from "@/components/editor/critique-panel";
import { useCritique } from "@/hooks/use-critique";
import { StatusBar } from "@/components/editor/status-bar";
import { ShareDialog } from "@/components/editor/share-dialog";
import { LiveblocksRoom } from "@/components/editor/liveblocks-room";
import { useSidebarState } from "@/components/workspace/sidebar";
import type { SaveStatus } from "@/hooks/use-canvas-autosave";

type RightPanelMode =
  | { type: "closed" }
  | { type: "ai" }
  | { type: "critique" }
  | { type: "inspector"; nodeId: string };

interface ProjectWorkspaceProps {
  project: {
    id: string;
    name: string;
    description: string | null;
  };
}

export function ProjectWorkspace({ project }: ProjectWorkspaceProps) {
  // Providers must wrap the content so hooks like useCritique (which call
  // useReactFlow / useEventListener) run *inside* both contexts.
  return (
    <LiveblocksRoom roomId={project.id}>
      <ReactFlowProvider>
        <WorkspaceContent project={project} />
      </ReactFlowProvider>
    </LiveblocksRoom>
  );
}

function WorkspaceContent({ project }: ProjectWorkspaceProps) {
  const [rightPanel, setRightPanel] = useState<RightPanelMode>({ type: "closed" });
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveFnRef = useRef<(() => Promise<void>) | null>(null);
  const { collapsed, toggle } = useSidebarState();

  const handleNodeCountChange = useCallback((count: number) => {
    setNodeCount(count);
  }, []);

  const handleZoomChange = useCallback((z: number) => {
    setZoom(z);
  }, []);

  const handleSaveStatusChange = useCallback((status: SaveStatus) => {
    setSaveStatus(status);
  }, []);

  const handleSaveReady = useCallback((fn: () => Promise<void>) => {
    saveFnRef.current = fn;
  }, []);

  const handleManualSave = useCallback(() => {
    saveFnRef.current?.();
  }, []);

  // Ctrl+S for manual save
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFnRef.current?.();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Node selection → open inspector
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    if (nodeId) {
      setRightPanel({ type: "inspector", nodeId });
    } else {
      setRightPanel((prev) =>
        prev.type === "inspector" ? { type: "closed" } : prev
      );
    }
  }, []);

  // Generate button → open AI panel
  const handleToggleAiPanel = useCallback(() => {
    setRightPanel((prev) =>
      prev.type === "ai" ? { type: "closed" } : { type: "ai" }
    );
  }, []);

  // Review button → open critique panel and start critique
  const critique = useCritique({ projectId: project.id });

  const handleToggleCritique = useCallback(() => {
    setRightPanel((prev) => {
      if (prev.type === "critique") return { type: "closed" };
      critique.startCritique();
      return { type: "critique" };
    });
  }, [critique]);

  const handleCloseRightPanel = useCallback(() => {
    setRightPanel({ type: "closed" });
  }, []);

  const projectStatus =
    saveStatus === "saving"
      ? "Saving..."
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "error"
          ? "Save Error"
          : "Draft";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <WorkspaceToolbar
            projectName={project.name}
            nodeCount={nodeCount}
            zoom={zoom}
            sidebarCollapsed={collapsed}
            saveStatus={saveStatus}
            onToggleSidebar={toggle}
            onOpenShare={() => setShareDialogOpen(true)}
            onToggleAiPanel={handleToggleAiPanel}
            onToggleCritique={handleToggleCritique}
            onManualSave={handleManualSave}
          />

          <ShareDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            projectId={project.id}
            projectName={project.name}
          />

          <div className="flex flex-1 overflow-hidden">
            <WorkspaceCanvas
              projectId={project.id}
              onNodeCountChange={handleNodeCountChange}
              onZoomChange={handleZoomChange}
              onNodeSelect={handleNodeSelect}
              onSaveStatusChange={handleSaveStatusChange}
              onSaveReady={handleSaveReady}
              onOpenAiPanel={() => setRightPanel({ type: "ai" })}
            />

            <AiPanel
              open={rightPanel.type === "ai"}
              onClose={handleCloseRightPanel}
              projectId={project.id}
            />
            <CritiquePanel
              open={rightPanel.type === "critique"}
              onClose={handleCloseRightPanel}
              status={critique.status}
              issues={critique.issues}
              summary={critique.summary}
              onDismissIssue={critique.dismissIssue}
              onFocusNode={critique.focusNode}
            />
            <NodeInspector
              open={rightPanel.type === "inspector"}
              nodeId={rightPanel.type === "inspector" ? rightPanel.nodeId : null}
              onClose={handleCloseRightPanel}
            />
          </div>

          <StatusBar
            projectStatus={projectStatus}
            nodeCount={nodeCount}
            zoom={zoom}
          />
    </div>
  );
}
