"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Suggestion } from "@/lib/ai/suggestions";

interface SuggestionChipProps {
  suggestion: Suggestion;
  onApply: (action: string) => void;
  onDismiss: () => void;
}

export function SuggestionChip({ suggestion, onApply, onDismiss }: SuggestionChipProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="pointer-events-auto"
    >
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--bg-surface)]/95 px-2.5 py-1 text-[10px] font-medium text-[var(--accent-primary)] shadow-lg shadow-black/20 backdrop-blur-sm transition-all hover:border-[var(--accent-primary)]/60 hover:shadow-[var(--accent-primary)]/10"
        >
          <Lightbulb className="h-3 w-3" />
          {suggestion.title}
        </button>
      ) : (
        <motion.div
          initial={{ width: "auto" }}
          animate={{ width: "auto" }}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]/95 p-2.5 shadow-xl shadow-black/25 backdrop-blur-sm"
          style={{ maxWidth: 240 }}
        >
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {suggestion.message}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={() => onApply(suggestion.suggestedAction)}
              className="h-6 gap-1 bg-[var(--accent-primary)] px-2 text-[10px] text-white hover:bg-[var(--accent-primary)]/90"
            >
              <Check className="h-3 w-3" />
              Apply
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 px-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3 w-3" />
            </Button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="ml-auto text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              Close
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
