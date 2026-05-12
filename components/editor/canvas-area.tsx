"use client";

import { motion } from "framer-motion";
import { GitBranch } from "lucide-react";

export function CanvasArea() {
  return (
    <div
      className="relative flex flex-1 items-center justify-center overflow-hidden"
      style={{
        backgroundColor: "var(--bg-base)",
        backgroundImage:
          "radial-gradient(circle, var(--border-default) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* Empty state */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-surface)]">
          <GitBranch className="h-8 w-8 text-[var(--text-muted)]" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Describe your system architecture
        </h2>
        <p className="max-w-sm text-sm text-[var(--text-secondary)]">
          Type a prompt below to generate your first diagram
        </p>
      </motion.div>
    </div>
  );
}
