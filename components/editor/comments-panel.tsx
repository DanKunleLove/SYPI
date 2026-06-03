"use client";

import "@liveblocks/react-ui/styles.css";
import "@liveblocks/react-ui/styles/dark/media-query.css";

import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Loader2 } from "lucide-react";
import { useThreads } from "@liveblocks/react";
import { Thread, Composer } from "@liveblocks/react-ui";
import { Button } from "@/components/ui/button";

interface CommentsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function CommentsPanel({ open, onClose }: CommentsPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
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
                <MessageSquare className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Comments
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={onClose}
              aria-label="Close comments"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <CommentsBody />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function CommentsBody() {
  const { threads, isLoading, error } = useThreads();

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
              Start a thread below. Use @ to mention a teammate — they&apos;ll get an email.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {threads.map((thread) => (
              <Thread
                key={thread.id}
                thread={thread}
                className="!bg-transparent p-2"
              />
            ))}
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
