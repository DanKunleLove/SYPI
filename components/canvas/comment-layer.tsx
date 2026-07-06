"use client";

import "@liveblocks/react-ui/styles.css";
import "@liveblocks/react-ui/styles/dark/attributes.css";

import { useState, useCallback, useEffect } from "react";
import { useViewport, useReactFlow } from "@xyflow/react";
import { useThreads } from "@liveblocks/react";
import { Thread, Composer } from "@liveblocks/react-ui";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X } from "lucide-react";

interface CommentLayerProps {
  /** Comment-placement mode: next canvas click drops a pin. */
  active: boolean;
  onExit: () => void;
}

/**
 * Canvas-anchored comments: threads with {x, y} metadata render as pins at
 * their flow coordinates (tracking pan/zoom), click opens the thread inline.
 * In placement mode, a click-catcher captures one canvas click → composer.
 */
export function CommentLayer({ active, onExit }: CommentLayerProps) {
  const { resolvedTheme } = useTheme();
  const viewport = useViewport();
  const { screenToFlowPosition } = useReactFlow();
  const { threads } = useThreads();
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);

  const pinned = (threads ?? []).filter(
    (t) => typeof t.metadata?.x === "number" && typeof t.metadata?.y === "number" && !t.resolved
  );

  const toScreen = useCallback(
    (fx: number, fy: number) => ({
      left: fx * viewport.zoom + viewport.x,
      top: fy * viewport.zoom + viewport.y,
    }),
    [viewport]
  );

  // Escape backs out: draft first, then placement mode, then open thread.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (draft) setDraft(null);
      else if (active) onExit();
      else if (openThreadId) setOpenThreadId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, active, openThreadId, onExit]);

  const handlePlaceClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setDraft(pos);
    },
    [screenToFlowPosition]
  );

  const theme = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      data-theme={theme}
    >
      {/* Placement click-catcher */}
      {active && !draft && (
        <div
          className="pointer-events-auto absolute inset-0 cursor-crosshair"
          onClick={handlePlaceClick}
        >
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--bg-surface)]/95 px-3 py-1.5 text-xs font-medium text-[var(--accent-primary)] shadow-lg backdrop-blur">
            Click anywhere to drop a comment — Esc to cancel
          </div>
        </div>
      )}

      {/* Pins */}
      {pinned.map((thread) => {
        const pos = toScreen(thread.metadata.x as number, thread.metadata.y as number);
        const isOpen = openThreadId === thread.id;
        return (
          <div key={thread.id} className="absolute" style={pos}>
            <button
              type="button"
              aria-label="Open comment thread"
              onClick={(e) => {
                e.stopPropagation();
                setOpenThreadId(isOpen ? null : thread.id);
              }}
              className={`pointer-events-auto -translate-x-1/2 -translate-y-full flex h-7 w-7 items-center justify-center rounded-full rounded-bl-none border-2 shadow-md transition-transform hover:scale-110 ${
                isOpen
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]"
                  : "border-white/70 bg-[var(--accent-primary)]"
              }`}
            >
              <MessageSquare className="h-3 w-3 text-white" />
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="pointer-events-auto absolute left-4 top-1 z-10 w-80 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl"
                >
                  <div className="flex items-center justify-end border-b border-[var(--border-default)] px-2 py-1">
                    <button
                      type="button"
                      aria-label="Close thread"
                      onClick={() => setOpenThreadId(null)}
                      className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    <Thread thread={thread} className="!bg-transparent" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Draft composer at the clicked spot */}
      {draft && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="pointer-events-auto absolute z-10 w-80 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl"
          style={toScreen(draft.x, draft.y)}
        >
          <Composer
            autoFocus
            metadata={{ x: draft.x, y: draft.y }}
            onComposerSubmit={() => {
              setDraft(null);
              onExit();
            }}
          />
        </motion.div>
      )}
    </div>
  );
}
