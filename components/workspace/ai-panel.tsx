"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Lightbulb, MessageSquare, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Suggestion } from "@/lib/ai/suggestions";
import { useSystemSpec } from "@/hooks/use-system-spec";
import { SpecHealthBar } from "./ai-panel/spec-health-bar";
import { ChatTab } from "./ai-panel/chat-tab";
import { SpecTab } from "./ai-panel/spec-tab";
import { SuggestionsTab } from "./ai-panel/suggestions-tab";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "suggestions", label: "Suggestions", icon: Lightbulb },
  { id: "spec", label: "Spec", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

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
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { spec, refresh: refreshSpec } = useSystemSpec(projectId);

  useEffect(() => {
    if (open && initialTab) setActiveTab(initialTab);
  }, [open, initialTab]);

  // When a prompt is pushed in (e.g. from suggestion/critique), always show chat tab
  useEffect(() => {
    if (open && initialPrompt) setActiveTab("chat");
  }, [open, initialPrompt]);

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

          {/* Spec health — hidden entirely until a spec exists, so a first-time
              user sees exactly the panel they saw before. */}
          <SpecHealthBar spec={spec} />

          {/* Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {activeTab === "chat" ? (
              <ChatTab
                projectId={projectId}
                inputRef={inputRef}
                initialPrompt={initialPrompt}
                spec={spec}
                onSpecChanged={refreshSpec}
              />
            ) : activeTab === "suggestions" ? (
              <SuggestionsTab
                suggestions={suggestions ?? []}
                onDismiss={onDismissSuggestion ?? (() => {})}
                onApply={onApplySuggestion ?? (() => {})}
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
