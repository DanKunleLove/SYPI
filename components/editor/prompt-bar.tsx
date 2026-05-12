"use client";

import { SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PromptBar() {
  return (
    <div className="absolute bottom-6 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 px-4">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-lg shadow-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-2 p-2">
          <textarea
            rows={1}
            placeholder="Describe your system architecture..."
            disabled
            aria-label="Architecture prompt"
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <Button
            size="icon"
            disabled
            aria-label="Send prompt"
            className="h-9 w-9 shrink-0 rounded-xl"
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="mt-1.5 text-center text-xs text-[var(--text-muted)]">
        Press Ctrl+Enter to send
      </p>
    </div>
  );
}
