"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Wrench, FileText, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "spi-onboarding-done";

const STEPS = [
  {
    icon: Sparkles,
    accent: true,
    title: "Describe your system",
    body: "Click Generate and type what you want to build — \"E-commerce platform with microservices\" or paste a URL. The AI Twin drafts a plan, you approve it, then it builds your canvas.",
    cta: "Got it",
  },
  {
    icon: Wrench,
    accent: false,
    title: "Refine & collaborate",
    body: "Click any node to edit it. Drag to connect. Use the Review button to get an AI critique of your architecture. Invite teammates — they'll see your cursor in real time.",
    cta: "Next",
  },
  {
    icon: FileText,
    accent: false,
    title: "Export & hand off",
    body: "Open the Spec tab to download a PNG image, a Markdown spec, a Mermaid diagram, or a full Agent Bundle — a ZIP your AI coding agent (Claude Code, Codex) can read and implement.",
    cta: "Start building",
  },
] as const;

interface OnboardingOverlayProps {
  /** Only show if this is the user's first project */
  isFirstProject: boolean;
}

export function OnboardingOverlay({ isFirstProject }: OnboardingOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isFirstProject) return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setVisible(true);
  }, [isFirstProject]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const advance = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-40 flex items-end justify-center pb-32"
        >
          {/* Card */}
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="pointer-events-auto relative w-[360px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-2xl shadow-black/40"
          >
            {/* Dismiss */}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Skip onboarding"
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Icon */}
            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                current.accent
                  ? "bg-[var(--accent-ai)]/15"
                  : "bg-[var(--bg-surface-raised)]"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  current.accent ? "text-[var(--accent-ai)]" : "text-[var(--text-muted)]"
                }`}
              />
            </div>

            {/* Text */}
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {current.title}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
              {current.body}
            </p>

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between">
              {/* Step dots */}
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step
                        ? "w-4 bg-[var(--accent-ai)]"
                        : "w-1.5 bg-[var(--border-subtle)]"
                    }`}
                  />
                ))}
              </div>

              <Button
                onClick={advance}
                size="sm"
                className={`gap-1.5 text-xs ${
                  isLast
                    ? "bg-[var(--accent-ai)] text-white hover:bg-[var(--accent-ai)]/90"
                    : "bg-[var(--bg-surface-raised)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)]"
                }`}
              >
                {current.cta}
                {!isLast && <ArrowRight className="h-3 w-3" />}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
