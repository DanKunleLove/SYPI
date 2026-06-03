"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { isToolUIPart } from "ai";
import { useReactFlow } from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  SendHorizonal,
  Lightbulb,
  FileText,
  MessageSquare,
  Loader2,
  Bot,
  User,
  Globe,
  Check,
  Pencil,
  Copy,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiChat } from "@/hooks/use-ai-chat";
import { useGeneration } from "@/hooks/use-generation";
import { serializeCanvasForAI } from "@/lib/ai/canvas-context";
import { generateSpecMarkdown } from "@/lib/spec";
import { createNodeData, generateNodeId } from "@/lib/canvas-utils";
import type { CanvasNode, CanvasEdge, NodeCategory } from "@/types/canvas";

type ChatMode = "generate" | "chat" | "url";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "suggestions", label: "Suggestions", icon: Lightbulb },
  { id: "spec", label: "Spec", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

const QUICK_PROMPTS = [
  "E-commerce platform with microservices",
  "Real-time chat application",
  "CI/CD pipeline with Kubernetes",
  "Event-driven data pipeline",
];

interface AiPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  /** Tab to show when the panel opens (e.g. "spec" from the Export button). */
  initialTab?: TabId;
}

export function AiPanel({ open, onClose, projectId, projectName, initialTab }: AiPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // When opened with a requested tab (Export → Spec), switch to it.
  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex h-full shrink-0 flex-col overflow-hidden border-l border-[var(--border-default)] bg-[var(--bg-surface)]"
        >
          {/* Header */}
          <div className="flex h-12 items-center justify-between border-b border-[var(--border-default)] px-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-ai)]/15">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent-ai)]" />
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                AI Twin
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={onClose}
              aria-label="Close AI panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tab bar */}
          <div className="flex shrink-0 border-b border-[var(--border-default)]">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
                    isActive
                      ? "text-[var(--accent-ai)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="ai-panel-tab"
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[var(--accent-ai)]"
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {activeTab === "chat" ? (
              <ChatTab projectId={projectId} inputRef={inputRef} />
            ) : activeTab === "suggestions" ? (
              <PlaceholderTab
                icon={Lightbulb}
                title="Smart Suggestions"
                description="Contextual recommendations for your architecture will appear here as you build your canvas."
              />
            ) : (
              <SpecTab projectId={projectId} projectName={projectName} />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function ChatTab({
  projectId,
  inputRef,
}: {
  projectId: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const reactFlow = useReactFlow();
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

  // Full architecture generation (prompt / URL → canvas) via Trigger.dev
  const { status: genStatus, step: genStep, generate } = useGeneration({
    projectId,
    getNodes,
    getEdges,
  });
  const isGenerating =
    genStatus === "submitting" ||
    genStatus === "generating" ||
    genStatus === "placing";

  const [mode, setMode] = useState<ChatMode>("generate");
  const [url, setUrl] = useState("");

  // Plan-then-execute: draft a plan the user approves before generating.
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [pendingGoal, setPendingGoal] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  // Track tool calls already applied to the canvas so we don't re-run them
  const appliedToolCallsRef = useRef<Set<string>>(new Set());
  // Cancels an in-flight plan stream (unmount, new request, or mode change)
  const planAbortRef = useRef<AbortController | null>(null);

  // Abort any in-flight plan stream on unmount
  useEffect(() => () => planAbortRef.current?.abort(), []);

  // Auto-scroll to bottom on new messages / streaming plan
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, plan]);

  const busy = isLoading || isGenerating || planning;

  // Step 1 — stream a plan for the user to approve.
  const requestPlan = useCallback(
    async (goal: string) => {
      // Supersede any in-flight plan request.
      planAbortRef.current?.abort();
      const controller = new AbortController();
      planAbortRef.current = controller;
      const isCurrent = () => planAbortRef.current === controller;

      setPendingGoal(goal);
      setPlanError(null);
      setPlan("");
      setPlanning(true);
      try {
        const nodes = getNodes();
        const edges = getEdges();
        const canvasContext =
          nodes.length > 0 ? serializeCanvasForAI(nodes, edges) : undefined;

        const res = await fetch("/api/ai/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: goal, canvasContext }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to draft a plan");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          if (!isCurrent()) return; // superseded — don't clobber newer state
          setPlan(acc);
        }
        if (!isCurrent()) return;
        setPlanning(false);
      } catch (e) {
        // Aborted (unmount / superseded / mode change) — leave state to the winner.
        if (controller.signal.aborted || !isCurrent()) return;
        setPlanning(false);
        setPlan(null);
        setPlanError(e instanceof Error ? e.message : "Failed to draft a plan");
      }
    },
    [getNodes, getEdges]
  );

  // Step 2 — approve the plan and run the full generation.
  const approvePlan = useCallback(() => {
    if (!plan) return;
    const goal = pendingGoal;
    const approved = plan;
    setPlan(null);
    setPlanning(false);
    generate(`${goal}\n\nUse this approved plan:\n${approved}`, "generate");
  }, [plan, pendingGoal, generate]);

  // Discard the plan and put the goal back in the input to edit / re-plan.
  const refinePlan = useCallback(() => {
    setPlan(null);
    setPlanning(false);
    setInput(pendingGoal);
    inputRef.current?.focus();
  }, [pendingGoal, setInput, inputRef]);

  const handleSend = useCallback(() => {
    if (busy) return;
    const text = input.trim();

    if (mode === "url") {
      const urlValue = url.trim();
      if (!urlValue) return;
      generate(text || `Analyze the architecture of ${urlValue}`, "url-analyze", urlValue);
      setInput("");
      setUrl("");
      return;
    }

    if (!text) return;
    if (mode === "generate") {
      // Plan first, then execute on approval.
      requestPlan(text);
    } else {
      sendMessage(text);
    }
    setInput("");
  }, [busy, mode, input, url, generate, sendMessage, setInput, requestPlan]);

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

        if (result.action === "addNode") {
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
  }, [messages, reactFlow]);

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Messages area */}
      <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto">
        {mode === "generate" && (planning || plan !== null) ? (
          <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--accent-ai)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Proposed plan
              </span>
              {planning && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-ai)]" />
              )}
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 text-xs leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
              {plan || (planning ? "Drafting a plan…" : "")}
            </div>
            {!planning && plan && (
              <div className="flex gap-2">
                <Button
                  onClick={approvePlan}
                  className="flex-1 gap-1.5 bg-[var(--accent-ai)] text-white hover:bg-[var(--accent-ai)]/90"
                >
                  <Check className="h-4 w-4" />
                  Approve &amp; Generate
                </Button>
                <Button
                  variant="ghost"
                  onClick={refinePlan}
                  className="gap-1.5 border border-[var(--border-default)] text-[var(--text-secondary)]"
                >
                  <Pencil className="h-4 w-4" />
                  Refine
                </Button>
              </div>
            )}
          </div>
        ) : !hasMessages ? (
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
                      setMode("generate");
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
                  {/* Show tool invocations */}
                  {msg.parts?.map((part, i) => {
                    if (!isToolUIPart(part)) return null;
                    return (
                      <div
                        key={i}
                        className="mt-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)]"
                      >
                        <span className="font-medium text-[var(--accent-ai)]">
                          {part.type.replace(/^tool-/, "")}
                        </span>
                        {part.state === "output-available" && (
                          <span className="ml-1.5 text-[var(--state-success)]">
                            Done
                          </span>
                        )}
                      </div>
                    );
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

      {/* Generation progress */}
      {isGenerating && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-md bg-[var(--accent-ai)]/10 px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-ai)]" />
          <span className="text-xs font-medium text-[var(--accent-ai)]">
            {genStep || "Working..."}
          </span>
        </div>
      )}

      {/* Generation error */}
      {genStatus === "error" && genStep && (
        <div className="mx-3 mb-2 rounded-md bg-[var(--state-error)]/10 px-3 py-2 text-xs text-[var(--state-error)]">
          {genStep}
        </div>
      )}

      {/* Plan error */}
      {planError && (
        <div className="mx-3 mb-2 rounded-md bg-[var(--state-error)]/10 px-3 py-2 text-xs text-[var(--state-error)]">
          {planError}
        </div>
      )}

      {/* Chat error */}
      {error && (
        <div className="mx-3 mb-2 rounded-md bg-[var(--state-error)]/10 px-3 py-2 text-xs text-[var(--state-error)]">
          {error.message}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[var(--border-default)] p-3 shrink-0">
        {/* Mode selector */}
        <div className="mb-2 flex gap-1">
          {([
            { id: "generate", label: "Generate", icon: Sparkles },
            { id: "chat", label: "Chat", icon: MessageSquare },
            { id: "url", label: "URL", icon: Globe },
          ] as const).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                // Leaving Generate cancels any in-flight/pending plan.
                if (m.id !== "generate") {
                  planAbortRef.current?.abort();
                  setPlanning(false);
                  setPlan(null);
                }
                setMode(m.id);
              }}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                mode === m.id
                  ? "bg-[var(--accent-ai)]/15 text-[var(--accent-ai)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              <m.icon className="h-3 w-3" />
              {m.label}
            </button>
          ))}
        </div>

        {/* URL field (URL mode only) */}
        {mode === "url" && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-1.5">
            <Globe className="h-3.5 w-3.5 shrink-0 text-[var(--accent-ai)]" />
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none disabled:opacity-50"
            />
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-2">
          <textarea
            ref={inputRef}
            rows={2}
            placeholder={
              mode === "generate"
                ? "Describe your system architecture..."
                : mode === "url"
                  ? "What to focus on (optional)..."
                  : "Ask about your architecture..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            disabled={busy || (mode === "url" ? !url.trim() : !input.trim())}
            onClick={handleSend}
            aria-label={mode === "chat" ? "Send message" : "Generate"}
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
          Ctrl+Enter to send
        </p>
      </div>
    </>
  );
}

function SpecTab({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const reactFlow = useReactFlow();
  const [overview, setOverview] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [copied, setCopied] = useState(false);

  const nodeCount = reactFlow.getNodes().length;

  // Recomputes when the AI overview changes; reads the canvas at compute time.
  const spec = useMemo(
    () =>
      generateSpecMarkdown({
        projectName,
        nodes: reactFlow.getNodes() as CanvasNode[],
        edges: reactFlow.getEdges() as CanvasEdge[],
        overview: overview ?? undefined,
        date: new Date().toISOString().slice(0, 10),
      }),
    [reactFlow, projectName, overview]
  );

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(spec).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [spec]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([spec], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe =
      (projectName || "architecture").replace(/[^a-z0-9]+/gi, "-").toLowerCase() ||
      "architecture";
    a.href = url;
    a.download = `${safe}-spec.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [spec, projectName]);

  const handleEnhance = useCallback(async () => {
    setEnhancing(true);
    try {
      const canvasContext = serializeCanvasForAI(
        reactFlow.getNodes() as CanvasNode[],
        reactFlow.getEdges() as CanvasEdge[]
      );
      const res = await fetch("/api/ai/spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, canvasContext }),
      });
      if (!res.ok) throw new Error("Failed to enhance");
      const data = await res.json();
      if (typeof data.overview === "string") setOverview(data.overview);
    } catch {
      // Graceful: keep the deterministic spec without an AI overview.
    } finally {
      setEnhancing(false);
    }
  }, [reactFlow, projectId]);

  if (nodeCount === 0) {
    return (
      <PlaceholderTab
        icon={FileText}
        title="Spec Preview"
        description="Add components to the canvas to generate a technical spec."
      />
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <pre className="whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {spec}
        </pre>
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--border-default)] p-3 shrink-0">
        <Button
          onClick={handleEnhance}
          disabled={enhancing}
          variant="ghost"
          className="gap-1.5 border border-[var(--border-default)] text-xs text-[var(--text-secondary)]"
        >
          {enhancing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent-ai)]" />
          )}
          {overview ? "Regenerate overview" : "Enhance with AI"}
        </Button>
        <div className="ml-auto flex gap-1.5">
          <Button
            onClick={handleCopy}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="Copy Markdown"
            aria-label="Copy Markdown"
          >
            {copied ? (
              <Check className="h-4 w-4 text-[var(--state-success)]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            onClick={handleDownload}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            title="Download .md"
            aria-label="Download Markdown"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

function PlaceholderTab({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Lightbulb;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-ai)]/10">
          <Icon className="h-6 w-6 text-[var(--accent-ai)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {title}
        </p>
        <p className="max-w-[240px] text-xs text-[var(--text-muted)]">
          {description}
        </p>
        <span className="mt-2 rounded-full bg-[var(--accent-ai)]/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--accent-ai)]">
          Coming soon
        </span>
      </div>
    </div>
  );
}
