"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isToolUIPart } from "ai";
import { useReactFlow } from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Check,
  Loader2,
  RotateCcw,
  SendHorizonal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiChat } from "@/hooks/use-ai-chat";
import { useGeneration } from "@/hooks/use-generation";
import { createNodeData, generateNodeId } from "@/lib/canvas-utils";
import { applyDiffOperations } from "@/lib/ai/canvas-diff";
import type { ArchitectureOutput, DiffOperation } from "@/lib/ai/schemas";
import type { CanvasNode, CanvasEdge, NodeCategory } from "@/types/canvas";
import { ToolActionCard } from "./tool-action-card";
import { OpenDecisionsTray } from "./open-decisions-tray";
import type { SpecDecision, SpecHead } from "@/hooks/use-system-spec";

const QUICK_PROMPTS = [
  "E-commerce platform with microservices",
  "Real-time chat application",
  "CI/CD pipeline with Kubernetes",
  "Event-driven data pipeline",
];

export function ChatTab({
  projectId,
  inputRef,
  initialPrompt,
  spec,
  onSpecChanged,
}: {
  projectId: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  initialPrompt?: string;
  spec?: SpecHead | null;
  onSpecChanged?: () => void;
}) {
  const reactFlow = useReactFlow();
  const [answering, setAnswering] = useState<string | null>(null);

  /**
   * Answer an open decision. Applies any resulting canvas operations through the
   * EXISTING applyDiffOperations engine — never placeArchitectureOnCanvas, which
   * stagger-adds fresh nodes and would duplicate the whole canvas.
   */
  const handleAnswer = useCallback(
    async (decision: SpecDecision, answer: string) => {
      setAnswering(decision.id);
      try {
        const res = await fetch("/api/uss/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            decisionId: decision.id,
            answer,
            nodes: reactFlow.getNodes(),
            edges: reactFlow.getEdges(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not record that");

        if (Array.isArray(data.operations) && data.operations.length > 0) {
          await applyDiffOperations(
            reactFlow,
            data.operations as DiffOperation[],
            reactFlow.getNodes() as CanvasNode[],
            reactFlow.getEdges() as CanvasEdge[]
          );
        }
        onSpecChanged?.();
      } catch {
        // Answering is an enhancement; a failure must not disturb the conversation.
      } finally {
        setAnswering(null);
      }
    },
    [projectId, reactFlow, onSpecChanged]
  );
  const getNodes = useCallback(() => reactFlow.getNodes() as CanvasNode[], [reactFlow]);
  const getEdges = useCallback(() => reactFlow.getEdges() as CanvasEdge[], [reactFlow]);

  const {
    messages,
    sendMessage,
    input,
    setInput,
    isLoading,
    error,
  } = useAiChat({
    projectId,
    getNodes,
    getEdges,
  });

  // Placement + revert/restore/rate for agent-generated architectures
  const {
    status: genStatus,
    step: genStep,
    lastGeneration,
    revertGeneration,
    restoreGeneration,
    rateGeneration,
    dismissLastGeneration,
    registerPlacement,
    placeArchitectureOnCanvas,
  } = useGeneration({
    projectId,
    getNodes,
    getEdges,
  });
  const isPlacing = genStatus === "placing";

  const scrollRef = useRef<HTMLDivElement>(null);
  // Track tool calls already applied to the canvas so we don't re-run them
  const appliedToolCallsRef = useRef<Set<string>>(new Set());

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const busy = isLoading || isPlacing;

  // Auto-trigger when a prompt is pushed in from suggestions / critique handoff.
  const lastAutoPromptRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!initialPrompt || initialPrompt === lastAutoPromptRef.current) return;
    lastAutoPromptRef.current = initialPrompt;
    const t = setTimeout(() => sendMessage(initialPrompt), 150);
    return () => clearTimeout(t);
  }, [initialPrompt, sendMessage]);

  const handleSend = useCallback(() => {
    if (busy) return;
    const text = input.trim();
    if (!text) return;
    sendMessage(text);
    setInput("");
  }, [busy, input, sendMessage, setInput]);

  // Handle tool call results — modify canvas
  useEffect(() => {
    for (const msg of messages) {
      if (!msg.parts) continue;
      for (const part of msg.parts) {
        if (!isToolUIPart(part)) continue;
        if (part.state !== "output-available") continue;
        // Apply each tool call exactly once
        if (appliedToolCallsRef.current.has(part.toolCallId)) continue;

        const result = part.output as Record<string, unknown>;
        if (!result?.action) continue;
        appliedToolCallsRef.current.add(part.toolCallId);

        if (result.action === "placeArchitecture") {
          // Agent-generated architecture → stagger-place + register for revert/rate.
          const architecture = result.architecture as ArchitectureOutput;
          const generationId = result.generationId as string;
          void (async () => {
            const placed = await placeArchitectureOnCanvas(architecture);
            registerPlacement(generationId, architecture, placed);
          })();
        } else if (result.action === "applyDiff") {
          const operations = result.operations as DiffOperation[];
          void applyDiffOperations(
            reactFlow,
            operations,
            reactFlow.getNodes() as CanvasNode[],
            reactFlow.getEdges() as CanvasEdge[]
          );
        } else if (result.action === "addNode") {
          const category = result.category as NodeCategory;
          const label = result.label as string;
          const description = result.description as string | undefined;
          const nodeData = createNodeData(category, label);
          if (description) nodeData.description = description;

          const viewport = reactFlow.getViewport();
          reactFlow.addNodes({
            id: generateNodeId(),
            type: "systemNode",
            position: {
              x: (-viewport.x + 400) / viewport.zoom,
              y: (-viewport.y + 300) / viewport.zoom,
            },
            data: nodeData,
          });
        } else if (result.action === "removeNode") {
          reactFlow.deleteElements({ nodes: [{ id: result.nodeId as string }] });
        } else if (result.action === "addEdge") {
          reactFlow.addEdges({
            id: `edge-${generateNodeId()}`,
            source: result.sourceId as string,
            target: result.targetId as string,
            type: "custom",
            data: {
              label: (result.label as string) ?? "",
              animated: true,
              edgeStyle: "default",
            },
          });
        }
      }
    }
  }, [messages, reactFlow, placeArchitectureOnCanvas, registerPlacement]);

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Messages area */}
      <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto">
        {!hasMessages ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-ai)]/10">
                <Sparkles className="h-7 w-7 text-[var(--accent-ai)]" />
              </div>
              <h3 className="text-sm font-medium text-[var(--text-primary)]">
                Your AI Twin
              </h3>
              <p className="max-w-[260px] text-xs leading-relaxed text-[var(--text-muted)]">
                Describe a system to generate it, paste a URL to reverse-engineer
                one, or chat to refine your architecture.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setInput(prompt);
                      inputRef.current?.focus();
                    }}
                    className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface-raised)] px-3 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-ai)]/40 hover:text-[var(--accent-ai)]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2.5 rounded-lg px-3 py-2",
                  msg.role === "user"
                    ? "bg-[var(--bg-surface-raised)]/50"
                    : "bg-transparent"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {msg.role === "user" ? (
                    <User className="h-4 w-4 text-[var(--text-muted)]" />
                  ) : (
                    <Bot className="h-4 w-4 text-[var(--accent-ai)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                    {(msg.parts ?? [])
                      .filter((p) => p.type === "text")
                      .map((p) => p.text)
                      .join("")}
                  </p>
                  {/* Tool invocations → action cards */}
                  {msg.parts?.map((part, i) => {
                    if (!isToolUIPart(part)) return null;
                    return <ToolActionCard key={i} part={part} />;
                  })}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-ai)]" />
                Thinking...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Placement in progress */}
      <AnimatePresence>
        {isPlacing && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-[var(--accent-ai)]/20 bg-[var(--accent-ai)]/5 px-3 py-2"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-ai)]" />
            <span className="text-xs font-medium text-[var(--accent-ai)]">
              {genStep || "Placing nodes on canvas…"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last generation — revert/restore + feedback */}
      <AnimatePresence>
        {lastGeneration && !isPlacing && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mx-3 mb-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-2.5"
          >
            <div className="flex items-center gap-2">
              {lastGeneration.reverted ? (
                <RotateCcw className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              ) : (
                <Check className="h-3.5 w-3.5 text-[var(--state-success)]" />
              )}
              <span className="text-xs text-[var(--text-primary)]">
                {lastGeneration.reverted
                  ? "Generation reverted"
                  : `${lastGeneration.architecture.nodes.length} components placed`}
              </span>
              <button
                type="button"
                onClick={dismissLastGeneration}
                aria-label="Dismiss"
                className="ml-auto rounded p-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={
                  lastGeneration.reverted ? restoreGeneration : revertGeneration
                }
                className="h-6 gap-1 border border-[var(--border-default)] px-2 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <RotateCcw
                  className={cn("h-3 w-3", lastGeneration.reverted && "-scale-x-100")}
                />
                {lastGeneration.reverted ? "Restore" : "Revert"}
              </Button>
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => rateGeneration(1)}
                  aria-label="Good result"
                  className={cn(
                    "rounded-md p-1 transition-colors",
                    lastGeneration.rating === 1
                      ? "bg-[var(--state-success)]/15 text-[var(--state-success)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <ThumbsUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => rateGeneration(-1)}
                  aria-label="Poor result"
                  className={cn(
                    "rounded-md p-1 transition-colors",
                    lastGeneration.rating === -1
                      ? "bg-[var(--state-error)]/15 text-[var(--state-error)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <ThumbsDown className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generation error */}
      {genStatus === "error" && genStep && (
        <div className="mx-3 mb-2 rounded-md bg-[var(--state-error)]/10 px-3 py-2 text-xs text-[var(--state-error)]">
          {genStep}
        </div>
      )}

      {/* Chat error */}
      {error && (
        <div className="mx-3 mb-2 rounded-md bg-[var(--state-error)]/10 px-3 py-2 text-xs text-[var(--state-error)]">
          {error.message}
        </div>
      )}

      {/* Open decisions — collapsed, above the composer, material only */}
      <OpenDecisionsTray spec={spec ?? null} onAnswer={handleAnswer} answering={answering} />

      {/* Input area */}
      <div className="border-t border-[var(--border-default)] p-3 shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-2">
          <textarea
            ref={inputRef}
            rows={2}
            placeholder="Describe a system, paste a URL, or ask anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            disabled={busy || !input.trim()}
            onClick={handleSend}
            aria-label="Send message"
            className="h-8 w-8 shrink-0 rounded-lg bg-[var(--accent-ai)] text-white hover:bg-[var(--accent-ai)]/90 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizonal className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-[var(--text-muted)]">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </>
  );
}
