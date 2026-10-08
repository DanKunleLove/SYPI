"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  FileText,
  HelpCircle,
  Lightbulb,
  ListChecks,
  MessageSquare,
  PackageCheck,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Suggestion } from "@/lib/ai/suggestions";
import { useSystemSpec } from "@/hooks/use-system-spec";
import { SpecHealthBar } from "./ai-panel/spec-health-bar";
import { ChatTab } from "./ai-panel/chat-tab";
import { SpecTab } from "./ai-panel/spec-tab";
import { SuggestionsTab } from "./ai-panel/suggestions-tab";
import { QuestionsTab } from "./ai-panel/questions-tab";
import { RisksTab } from "./ai-panel/risks-tab";
import { TasksTab } from "./ai-panel/tasks-tab";
import { HandoffTab } from "./ai-panel/handoff-tab";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "spec", label: "Spec", icon: FileText },
  { id: "handoff", label: "Handoff", icon: PackageCheck },
  { id: "questions", label: "Questions", icon: HelpCircle },
  { id: "risks", label: "Risks", icon: ShieldAlert },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "suggestions", label: "Tips", icon: Lightbulb },
] as const;

type TabId = (typeof TABS)[number]["id"];
const PRIMARY_TABS: TabId[] = ["chat", "spec", "handoff"];
const SECONDARY_TABS: TabId[] = ["questions", "risks", "tasks", "suggestions"];
const TAB_BY_ID = Object.fromEntries(TABS.map((tab) => [tab.id, tab])) as Record<
  TabId,
  (typeof TABS)[number]
>;

interface AiPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  initialTab?: TabId;
  /** Pre-load a prompt into the ChatTab and auto-trigger the plan flow. */
  initialPrompt?: string;
  suggestions?: Suggestion[];
  onDismissSuggestion?: (id: string) => void;
  onApplySuggestion?: (action: string) => void;
}

export function AiPanel({
  open, onClose, projectId, projectName,
  initialTab, initialPrompt,
  suggestions, onDismissSuggestion, onApplySuggestion,
}: AiPanelProps) {
  const [selection, setSelection] = useState<{
    tab: TabId; open: boolean; initialTab?: TabId; initialPrompt?: string;
  }>({ tab: initialPrompt ? "chat" : initialTab ?? "chat", open, initialTab, initialPrompt });
  const sameRequest = selection.open === open && selection.initialTab === initialTab && selection.initialPrompt === initialPrompt;
  const activeTab = sameRequest ? selection.tab : initialPrompt ? "chat" : initialTab ?? selection.tab;
  const setActiveTab = (tab: TabId) => setSelection({ tab, open, initialTab, initialPrompt });
  const reducedMotion = useReducedMotion();
  const [decisionsSignal, setDecisionsSignal] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { spec, refresh: refreshSpec } = useSystemSpec(projectId);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  return (
        <motion.aside
          initial={false}
          animate={{ width: open ? "min(440px, 100vw)" : "0px", opacity: open ? 1 : 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
          aria-hidden={!open}
          inert={!open}
          className="flex h-full shrink-0 flex-col overflow-hidden border-l border-[var(--border-default)] bg-[var(--bg-surface)]"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-default)] px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-ai)]/15">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent-ai)]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">AI Twin</p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">{projectName}</p>
              </div>
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

          <div className="shrink-0 space-y-2 border-b border-[var(--border-default)] p-2">
            <div className="grid grid-cols-3 gap-1">
              {PRIMARY_TABS.map((id) => {
                const tab = TAB_BY_ID[id];
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors",
                      isActive
                        ? "border-[var(--accent-ai)]/35 bg-[var(--accent-ai)]/12 text-[var(--accent-ai)]"
                        : "border-transparent text-[var(--text-muted)] hover:border-[var(--border-default)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-secondary)]"
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {SECONDARY_TABS.map((id) => {
                const tab = TAB_BY_ID[id];
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex h-7 min-w-0 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-colors",
                      isActive
                        ? "bg-[var(--bg-surface-raised)] text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-secondary)]"
                    )}
                  >
                    <tab.icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Spec health — hidden entirely until a spec exists, so a first-time
              user sees exactly the panel they saw before. */}
          <SpecHealthBar
            spec={spec}
            onOpenDecisions={() => {
              setActiveTab("chat");
              setDecisionsSignal((n) => n + 1);
            }}
          />

          {/* Content — min-h-0 so a tall tab scrolls inside the panel instead of
              overflowing past the bottom of it. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={activeTab === "chat" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
              <ChatTab
                key={projectId}
                projectId={projectId}
                inputRef={inputRef}
                initialPrompt={initialPrompt}
                spec={spec}
                onSpecChanged={refreshSpec}
                decisionsSignal={decisionsSignal}
              />
            </div>
            {activeTab === "chat" ? null : activeTab === "suggestions" ? (
              <SuggestionsTab
                suggestions={suggestions ?? []}
                onDismiss={onDismissSuggestion ?? (() => {})}
                onApply={onApplySuggestion ?? (() => {})}
              />
            ) : activeTab === "spec" ? (
              <SpecTab projectId={projectId} projectName={projectName} />
            ) : activeTab === "questions" ? (
              <QuestionsTab
                spec={spec}
                onOpenChatDecisions={() => {
                  setActiveTab("chat");
                  setDecisionsSignal((n) => n + 1);
                }}
              />
            ) : activeTab === "risks" ? (
              <RisksTab projectId={projectId} />
            ) : activeTab === "tasks" ? (
              <TasksTab projectId={projectId} />
            ) : (
              <HandoffTab projectId={projectId} projectName={projectName} />
            )}
          </div>
        </motion.aside>
  );
}
