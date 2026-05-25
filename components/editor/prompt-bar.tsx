"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PromptBar() {
  const [value, setValue] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
      className="absolute bottom-6 left-1/2 z-30 w-full max-w-2xl -translate-x-1/2 px-4"
    >
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 shadow-xl shadow-black/25 backdrop-blur-md transition-all focus-within:border-[var(--accent-primary)]/40 focus-within:shadow-[var(--accent-primary)]/5">
        <div className="flex items-center gap-2 p-2">
          <textarea
            rows={1}
            placeholder="Describe your system architecture..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Architecture prompt"
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                // Will wire to AI engine in P3
              }
            }}
          />
          <Button
            size="icon"
            disabled={!value.trim()}
            aria-label="Send prompt"
            className="h-9 w-9 shrink-0 rounded-xl bg-[var(--accent-ai)] text-white hover:bg-[var(--accent-ai)]/90 disabled:opacity-30"
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-[var(--text-muted)]">
        Press Ctrl+Enter to send
      </p>
    </motion.div>
  );
}
