"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Search, Sparkles, MousePointer2, FileDown, Users, Shield,
  Zap, Key, GitBranch, Share2, MessageSquare, Keyboard,
  ChevronRight, ChevronDown, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { openFeedback } from "@/components/feedback/feedback-widget";

interface HelpSection {
  id: string;
  icon: typeof Sparkles;
  color: string;
  title: string;
  summary: string;
  items: { title: string; description: string; shortcut?: string }[];
}

const SECTIONS: HelpSection[] = [
  {
    id: "ai-twin",
    icon: Sparkles,
    color: "var(--accent-ai)",
    title: "AI Twin — Generate & Refine",
    summary: "Describe your system in plain English and let the AI build the canvas for you.",
    items: [
      {
        title: "One conversation for everything",
        description: "Open the AI Twin panel and just talk. Describe a system — it proposes a plan in the chat, you discuss and approve, and it builds while narrating each step as visible action cards. No modes to switch, no silent background work: designing, reviewing, refining, and researching all happen in the same thread.",
      },
      {
        title: "Refine an existing canvas",
        description: "With nodes already on the canvas, just say what to change: 'Add a Redis cache layer between the API gateway and services.' The AI applies the diff — adding or removing only what changed, leaving everything else intact — and reports what it did.",
      },
      {
        title: "URL-to-architecture — real grounding",
        description: "Paste any public URL into the conversation. SYPI fetches the live site — framework fingerprints, response headers, page content — plus web research, and builds the architecture from that evidence. Components not visible in the evidence are marked 'Inferred'.",
      },
      {
        title: "Self-review before placing",
        description: "Watch the pipeline while generating: Research → Design → Review → Refine → Place. The AI critiques its own draft and fixes critical flaws before anything reaches your canvas.",
      },
      {
        title: "Revert, restore & rate",
        description: "After a generation, a result card appears in the panel. Revert removes everything that generation placed; Restore brings it back. Rate it 👍/👎 — your feedback improves generation quality over time.",
      },
      {
        title: "Ask anything",
        description: "The same conversation answers questions: 'What is the single point of failure here?' or 'How would I add horizontal scaling to the Order Service?' The AI explains — and can make the change directly if you ask it to.",
      },
    ],
  },
  {
    id: "canvas",
    icon: MousePointer2,
    color: "var(--accent-primary)",
    title: "Canvas — Build & Edit",
    summary: "Interactive node-based canvas with zoom, pan, multi-select, and real-time sync.",
    items: [
      {
        title: "Add a node",
        description: "Open the node palette (bottom-center of the canvas). Click a node type to place it at the centre, or drag it onto the canvas at any position. 9 types: Service, Database, Queue, Cache, Gateway, Client, Storage, Function, Custom.",
      },
      {
        title: "Connect nodes",
        description: "Hover a node — small handle circles appear on its edges. Drag from any handle to another node to create a connection. The arrow shows data flow direction. Double-click an edge to add or edit its label.",
      },
      {
        title: "Edit a node",
        description: "Double-click the node label to edit it inline. Click a node once to open the Node Inspector panel on the right — change the label, description, category, color, and technology config fields.",
      },
      {
        title: "Select multiple nodes",
        description: "Drag a selection box across nodes, or hold Shift and click each node. Then move, delete, or duplicate the selection.",
        shortcut: "Ctrl+A to select all",
      },
      {
        title: "Undo / Redo",
        description: "All canvas changes are tracked. Undo reverses the last change; redo re-applies it. History is shared in real time — collaborators see your undos too.",
        shortcut: "Ctrl+Z / Ctrl+Y",
      },
      {
        title: "Save canvas",
        description: "The canvas auto-saves every 3 seconds. Press Ctrl+S for an immediate save. A thumbnail of the current canvas is captured on manual save and shown on the project card in the dashboard.",
        shortcut: "Ctrl+S",
      },
    ],
  },
  {
    id: "critique",
    icon: Shield,
    color: "var(--state-success)",
    title: "AI Design Review",
    summary: "One-click architectural review: the AI flags SPOFs, missing layers, and security gaps.",
    items: [
      {
        title: "Run a review",
        description: "Click the Review button in the canvas toolbar. The AI analyses your architecture against reliability, scalability, security, completeness, and best-practices rules. Issues are grouped by severity: critical → warning → suggestion.",
      },
      {
        title: "Fix All with AI Twin",
        description: "In the review panel, click 'Fix all with AI Twin.' All issues are bundled into a single prompt and sent to the AI Twin chat — the AI generates a refined architecture that addresses every flagged problem.",
      },
      {
        title: "Click to focus",
        description: "Click any issue card to highlight the affected node on the canvas. The canvas pans and zooms to that node so you know exactly what to change.",
      },
    ],
  },
  {
    id: "suggestions",
    icon: Zap,
    color: "var(--state-warning)",
    title: "Smart Suggestions",
    summary: "Real-time pattern detection as you build — no need to wait for a full review.",
    items: [
      {
        title: "Automatic detection",
        description: "As you add nodes and connections, suggestion chips appear on the canvas near the affected area. Patterns detected: missing cache layer, ungated public services, direct client-to-database connections, no monitoring, no redundancy, missing queue for async ops.",
      },
      {
        title: "Apply with AI Twin",
        description: "Click a suggestion chip or the 'Apply with AI Twin' button in the Suggestions tab. The suggestion becomes a prompt in the AI Twin chat and is executed as a canvas refinement.",
      },
      {
        title: "Dismiss",
        description: "Click × on a suggestion chip to dismiss it for the current session. It won't reappear unless the canvas changes in a way that triggers it again.",
      },
    ],
  },
  {
    id: "export",
    icon: FileDown,
    color: "#10b981",
    title: "Export & Hand-off",
    summary: "Download the canvas in multiple formats — from slides to AI agent bundles.",
    items: [
      {
        title: "Spec tab — Markdown",
        description: "Open the AI Twin panel → Spec tab. A full Markdown technical specification is built instantly from the canvas graph: component table, connections with labels, per-node config, and notes. Click Enhance with AI to add an AI-written overview section.",
      },
      {
        title: "PNG image",
        description: "Export a PNG screenshot of the canvas for slides, documentation, or Figma. The image captures the full canvas at its current zoom level.",
      },
      {
        title: "Mermaid diagram",
        description: "Export as a Mermaid flowchart — paste it into a GitHub README, Notion page, or any Markdown document that supports Mermaid rendering.",
      },
      {
        title: "System Kit — your proper system",
        description: "The hero export. From the Spec tab, pick WHAT you're building — Software, Automation, Video, Image, Music, Writing, Marketing, or Business — and generate the context system seniors use, written from YOUR actual canvas: overview, structure, standards, AI workflow rules, and a progress tracker, tailored per domain (creative kits add style/consistency guides, asset libraries, and tool setup; code kits add code standards and a documented .env template). Code kits also let you pick WHERE you build (Claude Code, Cursor, Copilot, Windsurf, Lovable/v0) and ship each tool's native setup files; creative kits include a paste-ready KNOWLEDGE.md for ChatGPT/Claude/Gemini plus a prompting guide.",
      },
      {
        title: "Agent Bundle (ZIP)",
        description: "The most powerful export: a ZIP containing CLAUDE.md, ARCHITECTURE.md, spi-schema.json, and TASKS.md. Drop it into a conversation with Claude Code, Codex, or any AI coding agent and it will have full context to implement the architecture.",
      },
      {
        title: "Save as template",
        description: "Press the Templates button in the canvas toolbar to save the current canvas as a reusable template. Private templates are only visible to you; public templates appear in the template picker for all users.",
      },
    ],
  },
  {
    id: "collaborate",
    icon: Users,
    color: "var(--accent-primary)",
    title: "Collaboration",
    summary: "Invite teammates, see live cursors, and comment with @mentions.",
    items: [
      {
        title: "Invite collaborators",
        description: "Click the Share button in the canvas toolbar. Enter an email address to invite someone. They get Editor access by default; you can change it to Viewer. Add a discipline title (e.g. 'Backend Lead', 'PM') so everyone knows their role.",
      },
      {
        title: "Live cursors & presence",
        description: "Every active user appears as a coloured cursor with their name. The avatar stack (top-right of the canvas) shows who's currently in the workspace.",
      },
      {
        title: "Comments & @mentions",
        description: "Click the Comments button in the toolbar to open the comments panel. Add threads anywhere on the project. Type @ to mention a collaborator — they'll receive an email notification (if Resend is configured).",
      },
      {
        title: "Public share link",
        description: "In the Share dialog, click 'Generate share link' to get a view-only URL. Anyone with the link can see the canvas without signing in — useful for stakeholders, clients, or public portfolio pieces.",
      },
    ],
  },
  {
    id: "byok",
    icon: Key,
    color: "#f59e0b",
    title: "AI Settings — Keys & Custom Instructions",
    summary: "Power generation with your own model key and teach the AI Twin how you work.",
    items: [
      {
        title: "Custom instructions",
        description: "In Settings, write instructions your AI Twin applies to every generation, plan, and chat — 'Prefer AWS services', 'Always include monitoring', 'Explain briefly, I'm a backend engineer'. They layer on top of the built-in prompts and can never break the output format.",
      },
      {
        title: "Add a provider key",
        description: "Go to Settings → AI settings (click your avatar in the sidebar, or navigate to /settings). Enter your API key for Anthropic, OpenAI, or Google. Keys are encrypted with AES-256-GCM before being stored — only the last 4 characters are visible after saving.",
      },
      {
        title: "Set a default model",
        description: "After adding a key, pick a default model from the dropdown. All AI generation routes (plan, generate, critique, refine, chat) will use your key and chosen model instead of the platform Gemini key.",
      },
      {
        title: "Remove a key",
        description: "Click Remove on any provider card. If your default model used that provider, the default is cleared and the platform Gemini key is used as fallback.",
      },
    ],
  },
  {
    id: "templates",
    icon: GitBranch,
    color: "var(--accent-ai)",
    title: "Templates",
    summary: "Start from a pre-built architecture or save your own as a reusable template.",
    items: [
      {
        title: "Built-in templates",
        description: "When creating a new project, choose a template: Microservices (11 nodes), Serverless (8 nodes), Event-Driven/CQRS (9 nodes), or API Gateway (10 nodes). The canvas loads the pre-built architecture instantly.",
      },
      {
        title: "Save your own",
        description: "Build an architecture you want to reuse → click the Save as Template button in the canvas toolbar. Name it, add a description, choose private or public visibility. Your templates appear in the 'My Templates' section of the template picker.",
      },
      {
        title: "Community templates",
        description: "Public templates saved by any user appear in the Community section of the template picker. Load them as a starting point and modify from there.",
      },
    ],
  },
  {
    id: "shortcuts",
    icon: Keyboard,
    color: "var(--text-muted)",
    title: "Keyboard Shortcuts",
    summary: "Speed up your workflow without touching the mouse.",
    items: [
      { title: "Save canvas", description: "Immediately saves to Vercel Blob and captures a thumbnail.", shortcut: "Ctrl + S" },
      { title: "Select all nodes", description: "Selects every node and edge on the canvas.", shortcut: "Ctrl + A" },
      { title: "Copy selection", description: "Copies selected nodes to the clipboard.", shortcut: "Ctrl + C" },
      { title: "Paste", description: "Pastes copied nodes at the cursor position.", shortcut: "Ctrl + V" },
      { title: "Duplicate", description: "Duplicates selected nodes in place.", shortcut: "Ctrl + D" },
      { title: "Delete", description: "Deletes selected nodes and their connected edges.", shortcut: "Delete / Backspace" },
      { title: "Undo", description: "Reverses the last canvas change.", shortcut: "Ctrl + Z" },
      { title: "Redo", description: "Re-applies the last undone change.", shortcut: "Ctrl + Y" },
      { title: "Escape", description: "Deselects nodes, closes edit mode.", shortcut: "Esc" },
      { title: "Toggle sidebar", description: "Collapses or expands the left sidebar.", shortcut: "[" },
      { title: "Open help", description: "Opens this help panel.", shortcut: "?" },
    ],
  },
];

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
}

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>("ai-twin");

  const filtered = SECTIONS.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.items.some(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
      )
    );
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Help & feature guide
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Everything SYPI can do, and how to use it
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="border-b border-[var(--border-default)] px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  placeholder="Search features..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 text-sm bg-[var(--bg-base)]"
                />
              </div>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="mb-3 h-8 w-8 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">No results for "{search}"</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-default)]">
                  {filtered.map((section) => {
                    const Icon = section.icon;
                    const isExpanded = expandedId === section.id || search.trim().length > 0;
                    return (
                      <div key={section.id}>
                        {/* Section header */}
                        <button
                          type="button"
                          className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-[var(--bg-surface-raised)] transition-colors"
                          onClick={() =>
                            setExpandedId(isExpanded && !search ? null : section.id)
                          }
                        >
                          <div
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                            style={{
                              background: `color-mix(in srgb, ${section.color} 15%, transparent)`,
                            }}
                          >
                            <Icon
                              className="h-4 w-4"
                              style={{ color: section.color }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                              {section.title}
                            </p>
                            <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                              {section.summary}
                            </p>
                          </div>
                          {!search && (
                            isExpanded
                              ? <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                              : <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                          )}
                        </button>

                        {/* Items */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-0 bg-[var(--bg-base)] pb-1">
                                {section.items.map((item, i) => (
                                  <div
                                    key={i}
                                    className="px-5 py-3 border-b border-[var(--border-default)]/50 last:border-0"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                                        {item.title}
                                      </p>
                                      {item.shortcut && (
                                        <kbd className="shrink-0 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)]">
                                          {item.shortcut}
                                        </kbd>
                                      )}
                                    </div>
                                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                                      {item.description}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--border-default)] px-5 py-3 flex items-center justify-between">
              <p className="text-[10px] text-[var(--text-muted)]">
                Press <kbd className="rounded border border-[var(--border-subtle)] px-1 text-[10px]">?</kbd> anywhere to toggle
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openFeedback();
                }}
                className="inline-flex items-center gap-1 text-[10px] text-[var(--accent-ai)] hover:underline"
              >
                Send feedback <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
