"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Lightbulb, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "suggestions", label: "Suggestions", icon: Lightbulb },
  { id: "spec", label: "Spec Preview", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface AiSidebarProps {
  open: boolean;
}

export function AiSidebar({ open }: AiSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabId>("chat");

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex h-full shrink-0 flex-col overflow-hidden border-l border-[var(--border-default)] bg-[var(--bg-surface)]"
        >
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
                  <span className="hidden sm:inline">{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="ai-tab-indicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[var(--accent-ai)]"
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-ai)]/10">
                <Sparkles className="h-6 w-6 text-[var(--accent-ai)]" />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {activeTab === "chat" && "AI Chat"}
                {activeTab === "suggestions" && "Smart Suggestions"}
                {activeTab === "spec" && "Spec Preview"}
              </p>
              <p className="max-w-[220px] text-xs text-[var(--text-muted)]">
                {activeTab === "chat" &&
                  "AI-powered chat for architecture design is being built. This will let you refine your system with your AI twin."}
                {activeTab === "suggestions" &&
                  "Contextual suggestions for your canvas are under development. This feature will recommend components and patterns."}
                {activeTab === "spec" &&
                  "Automatic spec generation is in progress. This will export your architecture as a Markdown specification."}
              </p>
              <span className="mt-2 rounded-full bg-[var(--accent-ai)]/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--accent-ai)]">
                Under development
              </span>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
