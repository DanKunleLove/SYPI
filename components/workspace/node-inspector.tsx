"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Trash2,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getNodeConfig,
  NODE_COLORS,
  PALETTE_CATEGORIES,
  CATEGORY_CONFIG_FIELDS,
} from "@/lib/canvas-utils";
import type { CanvasNodeData, NodeCategory } from "@/types/canvas";
import { WhyPanel } from "@/components/workspace/why-panel";

interface NodeInspectorProps {
  open: boolean;
  nodeId: string | null;
  onClose: () => void;
  /** Optional: when present, the inspector can trace why this component exists. */
  projectId?: string;
}

export function NodeInspector({ open, nodeId, onClose, projectId }: NodeInspectorProps) {
  const reactFlow = useReactFlow();

  const node = nodeId ? reactFlow.getNode(nodeId) : null;
  const nodeData = node?.data as CanvasNodeData | undefined;
  const category = nodeData?.nodeCategory ?? "custom";
  const config = getNodeConfig(category);
  const Icon = config.icon;
  const accentColor = nodeData?.customColor ?? nodeData?.color ?? config.color;

  const updateField = useCallback(
    (field: string, value: string) => {
      if (!nodeId) return;
      reactFlow.updateNodeData(nodeId, { [field]: value });
    },
    [nodeId, reactFlow]
  );

  const handleDelete = useCallback(() => {
    if (!nodeId) return;
    reactFlow.deleteElements({ nodes: [{ id: nodeId }] });
    onClose();
  }, [nodeId, reactFlow, onClose]);

  const handleCategoryChange = useCallback(
    (newCategory: NodeCategory) => {
      if (!nodeId) return;
      const newConfig = getNodeConfig(newCategory);
      reactFlow.updateNodeData(nodeId, {
        nodeCategory: newCategory,
        color: newConfig.color,
        customColor: undefined,
      });
    },
    [nodeId, reactFlow]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      if (!nodeId) return;
      reactFlow.updateNodeData(nodeId, { customColor: color });
    },
    [nodeId, reactFlow]
  );

  const handleResetColor = useCallback(() => {
    if (!nodeId) return;
    reactFlow.updateNodeData(nodeId, { customColor: undefined });
  }, [nodeId, reactFlow]);

  // Get connected nodes
  const edges = reactFlow.getEdges();
  const connectedEdges = nodeId
    ? edges.filter((e) => e.source === nodeId || e.target === nodeId)
    : [];

  const connections = connectedEdges.map((edge) => {
    const isSource = edge.source === nodeId;
    const connectedNodeId = isSource ? edge.target : edge.source;
    const connectedNode = reactFlow.getNode(connectedNodeId);
    const connectedData = connectedNode?.data as CanvasNodeData | undefined;
    return {
      id: edge.id,
      direction: isSource ? ("outgoing" as const) : ("incoming" as const),
      nodeLabel: connectedData?.label ?? "Unknown",
      nodeCategory: connectedData?.nodeCategory ?? "custom",
    };
  });

  const configFields = CATEGORY_CONFIG_FIELDS[category] ?? [];

  return (
    <AnimatePresence>
      {open && nodeData && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 360, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative flex h-full shrink-0 flex-col border-l border-[var(--border-default)] bg-[var(--bg-surface)]"
          style={{ minWidth: 360 }}
        >
          {/* Header */}
          <div className="flex h-12 items-center justify-between border-b border-[var(--border-default)] px-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ backgroundColor: `${accentColor}20` }}
              >
                <Icon className="h-4 w-4" style={{ color: accentColor }} />
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {config.label} Node
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={onClose}
              aria-label="Close inspector"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-5 p-4">
              {/* Identity Section */}
              <Section title="Identity">
                <FieldRow label="Label">
                  <Input
                    value={nodeData.label}
                    onChange={(e) => updateField("label", e.target.value)}
                    className="h-8 text-sm bg-[var(--bg-base)] border-[var(--border-default)]"
                  />
                </FieldRow>
                <FieldRow label="Description">
                  <textarea
                    value={nodeData.description ?? ""}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="What does this component do?"
                    rows={2}
                    className="w-full resize-none rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]"
                  />
                </FieldRow>
                <FieldRow label="Category">
                  <select
                    value={category}
                    title="Node category"
                    aria-label="Node category"
                    onChange={(e) =>
                      handleCategoryChange(e.target.value as NodeCategory)
                    }
                    className="h-8 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                  >
                    {PALETTE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {getNodeConfig(cat).label}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              </Section>

              {/* Color Section */}
              <Section title="Color">
                <div className="flex flex-wrap gap-2">
                  {NODE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleColorChange(color)}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 transition-all hover:scale-110",
                        (nodeData.customColor ?? nodeData.color) === color
                          ? "border-white scale-110"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Set color to ${color}`}
                    />
                  ))}
                </div>
                {nodeData.customColor && (
                  <button
                    type="button"
                    onClick={handleResetColor}
                    className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to category default
                  </button>
                )}
              </Section>

              {/* System Config Section */}
              {configFields.length > 0 && (
                <Section title="System Config">
                  {configFields.map((field) => (
                    <FieldRow key={field.key} label={field.label}>
                      {field.type === "select" ? (
                        <>
                          <input
                            list={`datalist-${field.key}`}
                            value={(nodeData[field.key] as string) ?? ""}
                            placeholder={`Select or type ${field.label.toLowerCase()}...`}
                            aria-label={field.label}
                            onChange={(e) => updateField(field.key, e.target.value)}
                            className="h-8 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]"
                          />
                          <datalist id={`datalist-${field.key}`}>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                        </>
                      ) : (
                        <Input
                          value={(nodeData[field.key] as string) ?? ""}
                          onChange={(e) =>
                            updateField(field.key, e.target.value)
                          }
                          placeholder={field.placeholder}
                          className="h-8 text-sm bg-[var(--bg-base)] border-[var(--border-default)]"
                        />
                      )}
                    </FieldRow>
                  ))}
                </Section>
              )}

              {/* Connections Section */}
              {connections.length > 0 && (
                <Section title={`Connections (${connections.length})`}>
                  <div className="space-y-1.5">
                    {connections.map((conn) => {
                      const connConfig = getNodeConfig(conn.nodeCategory);
                      return (
                        <div
                          key={conn.id}
                          className="flex items-center gap-2 rounded-md bg-[var(--bg-base)] px-2.5 py-1.5"
                        >
                          {conn.direction === "outgoing" ? (
                            <ArrowRight
                              className="h-3 w-3 shrink-0"
                              style={{ color: accentColor }}
                            />
                          ) : (
                            <ArrowLeft
                              className="h-3 w-3 shrink-0"
                              style={{ color: connConfig.color }}
                            />
                          )}
                          <span className="flex-1 truncate text-xs text-[var(--text-primary)]">
                            {conn.nodeLabel}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {connConfig.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Why this exists — the reasoning chain, read backwards */}
              {projectId && typeof nodeData.label === "string" && (
                <div className="border-t border-[var(--border-default)] pt-4">
                  <WhyPanel projectId={projectId} label={nodeData.label} />
                </div>
              )}

              {/* Notes Section */}
              <Section title="Notes">
                <textarea
                  value={(nodeData.notes as string) ?? ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Add notes about this component..."
                  rows={3}
                  className="w-full resize-none rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-primary)]"
                />
              </Section>

              {/* Delete */}
              <div className="pt-2 border-t border-[var(--border-default)]">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-[var(--state-error)] hover:text-[var(--state-error)] hover:bg-[var(--state-error)]/10"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Node
                </Button>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {title}
      </h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-[var(--text-secondary)]">{label}</label>
      {children}
    </div>
  );
}
