"use client";

import "@liveblocks/react-ui/styles.css";
import "@liveblocks/react-ui/styles/dark/attributes.css";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Loader2, MapPin, SendHorizonal, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { useReactFlow } from "@xyflow/react";
import {
  useThreads,
  useSelf,
  useCreateFeed,
  useCreateFeedMessage,
  useFeedMessages,
} from "@liveblocks/react";
import { Thread, Composer } from "@liveblocks/react-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CommentsPanelProps {
  open: boolean;
  onClose: () => void;
}

type CollabTab = "threads" | "chat";

/** Collaborate panel: comment threads (incl. canvas-anchored pins) + team chat. */
export function CommentsPanel({ open, onClose }: CommentsPanelProps) {
  const { resolvedTheme } = useTheme();
  const [tab, setTab] = useState<CollabTab>("threads");

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          // Drives Liveblocks dark styles (attributes.css) from the app theme, not the OS
          data-theme={resolvedTheme === "dark" ? "dark" : "light"}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 360, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex h-full shrink-0 flex-col overflow-hidden border-l border-[var(--border-default)] bg-[var(--bg-surface)]"
        >
          {/* Header */}
          <div className="flex h-12 items-center justify-between border-b border-[var(--border-default)] px-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-primary)]/15">
                <Users className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Collaborate
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={onClose}
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 border-b border-[var(--border-default)]">
            {(
              [
                { id: "threads", label: "Threads", icon: MessageSquare },
                { id: "chat", label: "Team chat", icon: Users },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
                  tab === t.id
                    ? "text-[var(--accent-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {tab === t.id && (
                  <motion.div
                    layoutId="collab-panel-tab"
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[var(--accent-primary)]"
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  />
                )}
              </button>
            ))}
          </div>

          {tab === "threads" ? <ThreadsBody /> : <TeamChatBody />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function ThreadsBody() {
  const { threads, isLoading, error } = useThreads();
  const reactFlow = useReactFlow();

  const focusPin = useCallback(
    (x: number, y: number) => {
      reactFlow.setCenter(x, y, { duration: 400, zoom: Math.max(reactFlow.getZoom(), 0.9) });
    },
    [reactFlow]
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[var(--text-muted)]">
        Couldn&apos;t load comments. Try reopening the panel.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <MessageSquare className="h-7 w-7 text-[var(--text-muted)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">No comments yet</p>
            <p className="text-xs text-[var(--text-muted)]">
              Start a thread below, or use the pin tool in the canvas toolbar to
              comment on a specific spot. @ mentions send an email.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {threads.map((thread) => {
              const pinX = thread.metadata?.x;
              const pinY = thread.metadata?.y;
              const isPinned = typeof pinX === "number" && typeof pinY === "number";
              return (
                <div key={thread.id} className="relative">
                  {isPinned && (
                    <button
                      type="button"
                      onClick={() => focusPin(pinX, pinY)}
                      title="Show on canvas"
                      className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-0.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent-primary)]/40 hover:text-[var(--accent-primary)]"
                    >
                      <MapPin className="h-2.5 w-2.5" />
                      Canvas
                    </button>
                  )}
                  <Thread thread={thread} className="!bg-transparent p-2" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New-thread composer */}
      <div className="border-t border-[var(--border-default)] p-2 shrink-0">
        <Composer />
      </div>
    </div>
  );
}

function TeamChatBody() {
  const feedId = "team-chat";
  const feedCreatedRef = useRef(false);
  const createFeed = useCreateFeed();
  const createFeedMessage = useCreateFeedMessage();
  const feedResult = useFeedMessages(feedId);
  const me = useSelf();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = feedResult.isLoading ? [] : (feedResult.messages ?? []);

  useEffect(() => {
    if (feedCreatedRef.current) return;
    feedCreatedRef.current = true;
    createFeed(feedId, { metadata: { type: "team-chat" } }).catch(() => {
      // Feed may already exist — fine.
    });
  }, [createFeed]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    createFeedMessage(feedId, {
      role: "user",
      content: text,
      sender: me?.info?.name ?? "Teammate",
    }).catch(() => {});
  }, [input, createFeedMessage, me]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {feedResult.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <Users className="h-7 w-7 text-[var(--text-muted)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">Team chat</p>
            <p className="text-xs text-[var(--text-muted)]">
              A running conversation for everyone in this project — separate from
              comment threads and the AI Twin.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.data.sender === me?.info?.name;
            return (
              <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                <span className="mb-0.5 px-1 text-[10px] text-[var(--text-muted)]">
                  {m.data.sender ?? "Teammate"}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-1.5 text-xs leading-relaxed whitespace-pre-wrap",
                    mine
                      ? "bg-[var(--accent-primary)] text-white"
                      : "bg-[var(--bg-surface-raised)] text-[var(--text-primary)]"
                  )}
                >
                  {m.data.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-[var(--border-default)] p-2 shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-1.5">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the team…"
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button
            size="icon"
            disabled={!input.trim()}
            onClick={send}
            aria-label="Send message"
            className="h-7 w-7 shrink-0 rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-40"
          >
            <SendHorizonal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
