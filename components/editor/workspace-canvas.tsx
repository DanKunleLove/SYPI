"use client";

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  MarkerType,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import { useLiveblocksFlow, Cursors } from "@liveblocks/react-flow";
import { useUpdateMyPresence } from "@liveblocks/react/suspense";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  MessageSquare,
  LayoutTemplate,
  Mouse,
  ZoomIn,
  Wrench,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SystemNode } from "@/components/canvas/system-node";
import { CustomEdge } from "@/components/canvas/custom-edge";
import { NodePalette } from "@/components/canvas/node-palette";
import { PresenceAvatars } from "@/components/canvas/presence-avatars";
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import { CommentLayer } from "@/components/canvas/comment-layer";
import { CustomCursor } from "@/components/canvas/custom-cursor";
import { useCanvasShortcuts } from "@/hooks/use-canvas-shortcuts";
import { useCanvasAutosave, type SaveStatus } from "@/hooks/use-canvas-autosave";
import { createNodeData, generateNodeId } from "@/lib/canvas-utils";
import { SYSTEM_TEMPLATES } from "@/lib/templates";
import { SuggestionChip } from "@/components/canvas/suggestion-chip";
import { OnboardingOverlay } from "@/components/editor/onboarding-overlay";
import type { CanvasNode, CanvasEdge, NodeCategory } from "@/types/canvas";
import type { Suggestion } from "@/lib/ai/suggestions";
import type { SpiSchema } from "@/lib/export";

import "@xyflow/react/dist/style.css";

const nodeTypes: NodeTypes = {
  systemNode: SystemNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

interface WorkspaceCanvasProps {
  projectId: string;
  onNodeCountChange?: (count: number) => void;
  onZoomChange?: (zoom: number) => void;
  onNodeSelect?: (nodeId: string | null) => void;
  onSaveStatusChange?: (status: SaveStatus) => void;
  onSaveReady?: (saveFn: () => Promise<void>) => void;
  onOpenAiPanel?: () => void;
  suggestions?: Suggestion[];
  onDismissSuggestion?: (id: string) => void;
  onApplySuggestion?: (action: string) => void;
  /** When a right panel is open, hide the floating chips (they live in the panel). */
  rightPanelOpen?: boolean;
}

export function WorkspaceCanvas({
  projectId,
  onNodeCountChange,
  onZoomChange,
  onNodeSelect,
  onSaveReady,
  onSaveStatusChange,
  onOpenAiPanel,
  suggestions,
  onDismissSuggestion,
  onApplySuggestion,
  rightPanelOpen,
}: WorkspaceCanvasProps) {
  const flowResult = useLiveblocksFlow<CanvasNode, CanvasEdge>({
    suspense: true,
  });
  const nodes = flowResult.nodes as CanvasNode[];
  const edges = flowResult.edges as CanvasEdge[];
  const { onNodesChange, onEdgesChange, onConnect, onDelete } = flowResult;

  const reactFlowInstance = useReactFlow();
  const [showEmptyState, setShowEmptyState] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [commentMode, setCommentMode] = useState(false);
  const hasLoadedRef = useRef(false);

  // Register keyboard shortcuts
  useCanvasShortcuts();

  // Laser pointer: hold L → everyone sees your cursor as a glowing laser.
  const updateMyPresence = useUpdateMyPresence();
  useEffect(() => {
    const isTyping = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (
        (e.key === "l" || e.key === "L") &&
        !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !isTyping(e.target)
      ) {
        updateMyPresence({ laser: true });
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "l" || e.key === "L") updateMyPresence({ laser: false });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [updateMyPresence]);

  // Manual save only — no autosave, no performance impact
  const getNodes = useCallback(() => reactFlowInstance.getNodes(), [reactFlowInstance]);
  const getEdges = useCallback(() => reactFlowInstance.getEdges(), [reactFlowInstance]);
  const { status: saveStatus, save: manualSave } = useCanvasAutosave({
    projectId,
    getNodes,
    getEdges,
  });

  // Notify parent of save status changes
  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [saveStatus, onSaveStatusChange]);

  // Expose manual save function to parent
  useEffect(() => {
    onSaveReady?.(manualSave);
  }, [manualSave, onSaveReady]);

  // Load saved canvas on mount (if Liveblocks room is empty)
  useEffect(() => {
    if (hasLoadedRef.current) return;
    if (nodes.length > 0 || edges.length > 0) {
      hasLoadedRef.current = true;
      return;
    }

    hasLoadedRef.current = true;

    fetch(`/api/projects/${projectId}/canvas`)
      .then((res) => res.json())
      .then((data) => {
        if (data.nodes?.length > 0) {
          reactFlowInstance.addNodes(
            data.nodes.map((n: Record<string, unknown>) => ({
              ...n,
              type: (n.type as string) || "systemNode",
            }))
          );
        }
        if (data.edges?.length > 0) {
          reactFlowInstance.addEdges(data.edges);
        }
      })
      .catch(() => {
        // Silent fail — canvas starts empty
      });
  }, [projectId, nodes.length, edges.length, reactFlowInstance]);

  // Report node count — always fire so the parent gets the initial Liveblocks count
  useEffect(() => {
    onNodeCountChange?.(nodes.length);
  }, [nodes.length, onNodeCountChange]);

  // Hide empty state once nodes exist
  useEffect(() => {
    if (nodes.length > 0) {
      setShowEmptyState(false);
    }
  }, [nodes.length]);

  // Report zoom changes
  const handleMoveEnd = useCallback(() => {
    const zoom = reactFlowInstance.getZoom();
    onZoomChange?.(Math.round(zoom * 100));
  }, [reactFlowInstance, onZoomChange]);

  // Handle drop from node palette drag
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const category = e.dataTransfer.getData("application/spi-node-type") as NodeCategory;
      if (!category) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const newNode = {
        id: generateNodeId(),
        type: "systemNode",
        position,
        data: createNodeData(category),
      };

      reactFlowInstance.addNodes(newNode);
      setShowEmptyState(false);
    },
    [reactFlowInstance]
  );

  // Node click → notify parent to open inspector
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: CanvasNode) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect]
  );

  // Canvas background click → deselect / close inspector
  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // Start building manually — dismiss empty state
  const handleStartManual = useCallback(() => {
    setShowEmptyState(false);
  }, []);

  // Load a template onto the canvas — built-in (by id) or user template (by schema)
  const handleLoadTemplate = useCallback(
    (templateId: string, userSchema?: SpiSchema) => {
      // User template: schema is passed directly
      const schema = userSchema ?? SYSTEM_TEMPLATES.find((t) => t.id === templateId)?.schema;
      if (!schema) return;
      reactFlowInstance.addNodes(
        schema.nodes.map((n) => ({ ...n, type: n.type || "systemNode" }))
      );
      reactFlowInstance.addEdges(
        schema.edges.map((e) => ({
          ...e,
          type: e.type || "custom",
          animated: true,
          data: e.data ?? {},
        }))
      );
      setShowEmptyState(false);
      setShowTemplates(false);
      setTimeout(() => reactFlowInstance.fitView({ duration: 400, padding: 0.15 }), 100);
    },
    [reactFlowInstance]
  );

  const isEmpty = nodes.length === 0;

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Animated radial glow */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.04) 0%, transparent 70%)",
        }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background:
            "radial-gradient(ellipse 40% 40% at 50% 40%, rgba(167,139,250,0.03) 0%, transparent 70%)",
        }}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        onMoveEnd={handleMoveEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        selectionOnDrag
        selectNodesOnDrag
        elementsSelectable
        connectionLineStyle={{
          stroke: "var(--accent-primary)",
          strokeWidth: 2,
        }}
        defaultEdgeOptions={{
          type: "custom",
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: "var(--border-subtle)",
          },
          style: {
            stroke: "var(--border-subtle)",
            strokeWidth: 2,
          },
        }}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        {/* Collaborative cursors — custom small cursor with name label */}
        <Cursors components={{ Cursor: CustomCursor }} />

        {/* Dot grid background */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--border-default)"
        />

      </ReactFlow>

      {/* Canvas-anchored comment pins + placement mode */}
      <CommentLayer active={commentMode} onExit={() => setCommentMode(false)} />

      {/* Presence avatars — top right */}
      <PresenceAvatars />

      {/* Canvas toolbar — bottom left (zoom + undo/redo + comment pin) */}
      <CanvasToolbar
        commentMode={commentMode}
        onToggleCommentMode={() => setCommentMode((v) => !v)}
      />

      {/* Suggestion chips — bottom-right, up to 3.
          When a right panel is open the canvas narrows, so scale the stack
          down (pinned to its corner) to stay clear of the panel and node
          palette instead of crowding them. */}
      {suggestions && suggestions.length > 0 && (
        <div
          className={`absolute bottom-16 right-4 z-20 flex flex-col items-end gap-2 pointer-events-none origin-bottom-right transition-transform duration-200 ${
            rightPanelOpen ? "scale-90" : "scale-100"
          }`}
        >
          <AnimatePresence>
            {suggestions.slice(0, 3).map((s) => (
              <div key={s.id} className="pointer-events-auto">
                <SuggestionChip
                  suggestion={s}
                  onApply={(action) => onApplySuggestion?.(action)}
                  onDismiss={() => onDismissSuggestion?.(s.id)}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state overlay */}
      <AnimatePresence>
        {isEmpty && showEmptyState && (
          <EmptyState
            onStartManual={handleStartManual}
            onStartFromPrompt={onOpenAiPanel}
            onShowTemplates={() => setShowTemplates(true)}
          />
        )}
      </AnimatePresence>

      {/* Template picker modal */}
      <AnimatePresence>
        {showTemplates && (
          <TemplatePicker
            onSelect={(id, schema) => handleLoadTemplate(id, schema)}
            onClose={() => setShowTemplates(false)}
          />
        )}
      </AnimatePresence>

      {/* Node palette */}
      {(!showEmptyState || !isEmpty) && <NodePalette />}

      {/* First-run onboarding overlay */}
      <OnboardingOverlay isFirstProject={true} />
    </div>
  );
}

function EmptyState({
  onStartManual,
  onStartFromPrompt,
  onShowTemplates,
}: {
  onStartManual: () => void;
  onStartFromPrompt?: () => void;
  onShowTemplates?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="pointer-events-auto flex flex-col items-center gap-6 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-surface)] shadow-lg shadow-black/20">
          <GitBranch className="h-8 w-8 text-[var(--text-muted)]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            Describe your system architecture
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-[var(--text-secondary)]">
            Start with a prompt, build manually, or pick a template
          </p>
        </div>

        <div className="flex gap-3">
          <QuickAction
            icon={MessageSquare}
            label="Start from prompt"
            description="Describe your system"
            accent
            onClick={onStartFromPrompt}
          />
          <QuickAction
            icon={Wrench}
            label="Build manually"
            description="Drag and drop nodes"
            onClick={onStartManual}
          />
          <QuickAction
            icon={LayoutTemplate}
            label="Use a template"
            description="Pre-built architectures"
            onClick={onShowTemplates}
          />
        </div>

        <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <Mouse className="h-3 w-3" />
            Space + drag to pan
          </span>
          <span className="flex items-center gap-1.5">
            <ZoomIn className="h-3 w-3" />
            Scroll to zoom
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  accent,
  disabled,
  onClick,
}: {
  icon: typeof MessageSquare;
  label: string;
  description: string;
  accent?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="ghost"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-auto flex-col gap-1.5 rounded-xl border p-4 ${
        accent
          ? "border-[var(--accent-ai)]/30 bg-[var(--accent-ai)]/5 hover:border-[var(--accent-ai)]/60 hover:bg-[var(--accent-ai)]/10"
          : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-subtle)]"
      } disabled:opacity-40`}
    >
      <Icon
        className={`h-5 w-5 ${accent ? "text-[var(--accent-ai)]" : "text-[var(--text-muted)]"}`}
      />
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {label}
      </span>
      <span className="text-[11px] text-[var(--text-muted)]">{description}</span>
    </Button>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  web: "var(--accent-primary)",
  data: "var(--state-success)",
  infra: "var(--accent-ai)",
  mobile: "var(--state-warning)",
};

interface UserTemplate {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  schema: SpiSchema;
  user?: { name: string | null } | null;
}

function TemplatePicker({
  onSelect,
  onClose,
}: {
  onSelect: (id: string, schema?: SpiSchema) => void;
  onClose: () => void;
}) {
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [communityTemplates, setCommunityTemplates] = useState<UserTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : { own: [], community: [] }))
      .then((d) => {
        setUserTemplates(d.own ?? []);
        setCommunityTemplates(d.community ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const renderCard = (name: string, description: string | null | undefined, nodes: number, edges: number, accent: string, onClick: () => void, badge?: string) => (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4 text-left transition-all hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface-raised)]"
    >
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
        <span className="flex-1 truncate text-xs font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-ai)]">
          {name}
        </span>
        {badge && (
          <span className="rounded-full bg-[var(--accent-primary)]/10 px-1.5 py-0.5 text-[9px] text-[var(--accent-primary)]">
            {badge}
          </span>
        )}
      </div>
      {description && (
        <p className="text-[11px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
          {description}
        </p>
      )}
      <p className="text-[10px] text-[var(--text-muted)]">
        {nodes} components · {edges} connections
      </p>
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">System Templates</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Load a pre-built architecture. You can customize it after loading.
          </p>
        </div>

        {/* My templates */}
        {!loading && userTemplates.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              My templates
            </p>
            <div className="grid grid-cols-2 gap-3">
              {userTemplates.map((t) =>
                renderCard(
                  t.name,
                  t.description,
                  t.schema.nodes.length,
                  t.schema.edges.length,
                  CATEGORY_COLORS[t.category as keyof typeof CATEGORY_COLORS] ?? "var(--accent-ai)",
                  () => onSelect(t.id, t.schema),
                  t.user?.name ?? undefined
                )
              )}
            </div>
          </div>
        )}

        {/* Built-in templates */}
        <div className="mb-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Built-in
          </p>
          <div className="grid grid-cols-2 gap-3">
            {SYSTEM_TEMPLATES.map((t) =>
              renderCard(
                t.name,
                t.description,
                t.schema.nodes.length,
                t.schema.edges.length,
                CATEGORY_COLORS[t.category] ?? "var(--accent-primary)",
                () => onSelect(t.id)
              )
            )}
          </div>
        </div>

        {/* Community templates */}
        {!loading && communityTemplates.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Community
            </p>
            <div className="grid grid-cols-2 gap-3">
              {communityTemplates.map((t) =>
                renderCard(
                  t.name,
                  t.description,
                  t.schema.nodes.length,
                  t.schema.edges.length,
                  CATEGORY_COLORS[t.category as keyof typeof CATEGORY_COLORS] ?? "var(--accent-primary)",
                  () => onSelect(t.id, t.schema),
                  t.user?.name ?? undefined
                )
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
