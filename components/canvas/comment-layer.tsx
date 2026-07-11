"use client";

import "@liveblocks/react-ui/styles.css";
import "@liveblocks/react-ui/styles/dark/attributes.css";

import { useState, useCallback, useEffect, useRef } from "react";
import { useViewport, useReactFlow } from "@xyflow/react";
import {
  useThreads,
  useDeleteThread,
  useEditThreadMetadata,
  useMarkThreadAsResolved,
} from "@liveblocks/react";
import { Thread, Composer } from "@liveblocks/react-ui";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Check, Trash2 } from "lucide-react";

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
  const { screenToFlowPosition, setCenter } = useReactFlow();
  const { threads } = useThreads();
  const deleteThread = useDeleteThread();
  const editThreadMetadata = useEditThreadMetadata();
  const markThreadAsResolved = useMarkThreadAsResolved();
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);

  // Pin dragging: live screen position while a pin is being moved, plus a
  // ref that tracks the gesture so a drag doesn't also fire the open-click.
  const dragRef = useRef<{ threadId: string; startX: number; startY: number; moved: boolean } | null>(null);
  const justDraggedRef = useRef(false);
  const [dragPos, setDragPos] = useState<{ threadId: string; left: number; top: number } | null>(null);

  // Track layer size so off-viewport pins get an edge indicator.
  const layerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  // Pins whose screen position falls outside the layer, clamped to its edges.
  const EDGE_MARGIN = 16;
  const offscreen =
    size.width > 0
      ? pinned.flatMap((thread) => {
          const fx = thread.metadata.x as number;
          const fy = thread.metadata.y as number;
          const pos = toScreen(fx, fy);
          if (
            pos.left >= 0 && pos.left <= size.width &&
            pos.top >= 0 && pos.top <= size.height
          ) {
            return [];
          }
          return [{
            thread,
            fx,
            fy,
            left: Math.min(Math.max(pos.left, EDGE_MARGIN), size.width - EDGE_MARGIN),
            top: Math.min(Math.max(pos.top, EDGE_MARGIN), size.height - EDGE_MARGIN),
          }];
        })
      : [];

  return (
    <div
      ref={layerRef}
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
        const base = toScreen(thread.metadata.x as number, thread.metadata.y as number);
        const isDragging = dragPos?.threadId === thread.id;
        const pos = isDragging ? { left: dragPos.left, top: dragPos.top } : base;
        const isOpen = openThreadId === thread.id;
        return (
          <div key={thread.id} className="absolute" style={pos}>
            <button
              type="button"
              aria-label="Comment thread — click to open, drag to move"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = {
                  threadId: thread.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  moved: false,
                };
              }}
              onPointerMove={(e) => {
                const d = dragRef.current;
                if (!d || d.threadId !== thread.id) return;
                if (
                  !d.moved &&
                  Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4
                ) {
                  d.moved = true;
                  setOpenThreadId(null); // don't drag the popup around
                }
                if (d.moved) {
                  const rect = layerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setDragPos({
                      threadId: thread.id,
                      left: e.clientX - rect.left,
                      top: e.clientY - rect.top,
                    });
                  }
                }
              }}
              onPointerUp={(e) => {
                const d = dragRef.current;
                dragRef.current = null;
                if (d?.moved) {
                  justDraggedRef.current = true;
                  const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
                  editThreadMetadata({
                    threadId: thread.id,
                    metadata: { x: flow.x, y: flow.y },
                  });
                  setDragPos(null);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (justDraggedRef.current) {
                  justDraggedRef.current = false;
                  return;
                }
                setOpenThreadId(isOpen ? null : thread.id);
              }}
              className={`pointer-events-auto -translate-x-1/2 -translate-y-full flex h-7 w-7 cursor-grab items-center justify-center rounded-full rounded-bl-none border-2 shadow-md transition-transform hover:scale-110 active:cursor-grabbing ${
                isOpen
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]"
                  : "border-white/70 bg-[var(--accent-primary)]"
              }`}
            >
              <MessageSquare className="h-3 w-3 text-white" />
            </button>

            <AnimatePresence>
              {isOpen && !isDragging && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="pointer-events-auto absolute left-4 top-1 z-10 w-80 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-[var(--border-default)] px-2 py-1">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        aria-label="Resolve and remove pin"
                        title="Resolve — marks it done and removes the pin"
                        onClick={() => {
                          markThreadAsResolved(thread.id);
                          setOpenThreadId(null);
                        }}
                        className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--accent-primary)]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Resolve
                      </button>
                      <button
                        type="button"
                        aria-label="Delete thread"
                        title="Delete this comment thread"
                        onClick={() => {
                          deleteThread(thread.id);
                          setOpenThreadId(null);
                        }}
                        className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
                    <Thread
                      thread={thread}
                      showResolveAction={false}
                      className="!bg-transparent"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Off-viewport pins: edge indicators that pan to the pin */}
      {offscreen.map(({ thread, fx, fy, left, top }) => (
        <button
          key={`off-${thread.id}`}
          type="button"
          aria-label="Jump to off-screen comment"
          title="Jump to comment"
          onClick={() => setCenter(fx, fy, { zoom: viewport.zoom, duration: 300 })}
          className="pointer-events-auto absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--accent-primary)]/50 bg-[var(--bg-surface)]/95 shadow-md backdrop-blur transition-transform hover:scale-110"
          style={{ left, top }}
        >
          <MessageSquare className="h-3 w-3 text-[var(--accent-primary)]" />
        </button>
      ))}

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
