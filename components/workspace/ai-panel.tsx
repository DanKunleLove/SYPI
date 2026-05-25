"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  SendHorizonal,
  Lightbulb,
  FileText,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "suggestions", label: "Suggestions", icon: Lightbulb },
  { id: "spec", label: "Spec", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface AiPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AiPanel({ open, onClose }: AiPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus input when panel opens
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

          {/* Content area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {activeTab === "chat" ? (
              <ChatTab
                message={message}
                setMessage={setMessage}
                inputRef={inputRef}
              />
            ) : activeTab === "suggestions" ? (
              <PlaceholderTab
                icon={Lightbulb}
                title="Smart Suggestions"
                description="Contextual recommendations for your architecture will appear here as you build your canvas."
              />
            ) : (
              <PlaceholderTab
                icon={FileText}
                title="Spec Preview"
                description="A live preview of your generated Markdown specification will appear here."
              />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function ChatTab({
  message,
  setMessage,
  inputRef,
}: {
  message: string;
  setMessage: (v: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <>
      {/* Messages area */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 overflow-y-auto">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-ai)]/10">
            <Sparkles className="h-7 w-7 text-[var(--accent-ai)]" />
          </div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Describe your architecture
          </h3>
          <p className="max-w-[260px] text-xs leading-relaxed text-[var(--text-muted)]">
            Tell your AI twin what system you want to design. It will generate
            nodes and connections on the canvas.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <QuickPrompt label="E-commerce API" />
            <QuickPrompt label="Chat system" />
            <QuickPrompt label="CI/CD pipeline" />
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--border-default)] p-3 shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-2">
          <textarea
            ref={inputRef}
            rows={2}
            placeholder="Describe your system..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                // Will wire to AI engine in P3
              }
            }}
          />
          <Button
            size="icon"
            disabled={!message.trim()}
            aria-label="Send prompt"
            className="h-8 w-8 shrink-0 rounded-lg bg-[var(--accent-ai)] text-white hover:bg-[var(--accent-ai)]/90 disabled:opacity-40"
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-[var(--text-muted)]">
          Ctrl+Enter to send
        </p>
      </div>
    </>
  );
}

function QuickPrompt({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface-raised)] px-3 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-ai)]/40 hover:text-[var(--accent-ai)]"
    >
      {label}
    </button>
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
