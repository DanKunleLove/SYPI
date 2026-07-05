"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, MousePointer2, FileDown, LifeBuoy, ArrowRight, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "spi-onboarding-v3-done";

const STEPS = [
  {
    icon: Sparkles,
    color: "var(--accent-ai)",
    badge: "Step 1 of 4",
    title: "Tell your AI Twin what to build",
    body: "Open the AI Twin panel on the right and describe your system — \"E-commerce platform with microservices\" — or paste any live URL to reverse-engineer its real stack. The AI drafts a plan you can discuss and refine, then builds the canvas, reviewing its own design before placing it.",
    hint: "→ Click the AI Twin button on the right toolbar to start",
    cta: "Got it, what's next?",
  },
  {
    icon: MousePointer2,
    color: "var(--accent-primary)",
    badge: "Step 2 of 4",
    title: "Refine with your team",
    body: "Click any node to inspect and edit it. Drag from a node's handle to connect services. Hit Review for an AI design critique, or Revert if a generation isn't right. Invite teammates from Share — they appear as live cursors and can comment with @mentions.",
    hint: "→ Try clicking a node after generation completes",
    cta: "Nice — and then?",
  },
  {
    icon: FileDown,
    color: "var(--state-success)",
    badge: "Step 3 of 4",
    title: "Export and hand off",
    body: "Open the Spec tab in the AI Twin panel: download a PNG for slides, Markdown for docs, Mermaid for GitHub, or an Agent Bundle ZIP that Claude Code or Codex can read and implement directly.",
    hint: "→ Spec tab lives in the AI Twin panel",
    cta: "One more thing…",
  },
  {
    icon: LifeBuoy,
    color: "var(--state-warning)",
    badge: "Step 4 of 4",
    title: "Make it yours — and get help anytime",
    body: "Press ? anywhere for the full feature guide with every shortcut. In Settings you can add your own Claude, GPT, or Gemini API key and write custom instructions that teach your AI Twin how you like to work — they apply to every generation.",
    hint: "→ Press ? for help · Settings lives under your avatar",
    cta: "Let's build",
  },
] as const;

interface OnboardingOverlayProps {
  isFirstProject: boolean;
}

export function OnboardingOverlay({ isFirstProject }: OnboardingOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!isFirstProject) return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [isFirstProject]);

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
      setExiting(false);
    }, 300);
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
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop — subtle dark veil to focus attention */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: exiting ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-auto absolute inset-0 z-40 bg-black/50 backdrop-blur-[1px]"
            onClick={dismiss}
          />

          {/* Card — centred, large */}
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 0.94 : 1, y: exiting ? 24 : 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl shadow-black/60 overflow-hidden">

              {/* Progress bar */}
              <div className="absolute inset-x-0 top-0 h-0.5 bg-[var(--bg-surface-raised)]">
                <motion.div
                  className="h-full"
                  style={{ background: current.color }}
                  initial={{ width: `${((step) / STEPS.length) * 100}%` }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>

              <div className="p-6 pt-7">
                {/* Dismiss */}
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Skip onboarding"
                  className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {/* Badge */}
                <span
                  className="mb-4 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    background: `color-mix(in srgb, ${current.color} 15%, transparent)`,
                    color: current.color,
                  }}
                >
                  {current.badge}
                </span>

                {/* Icon */}
                <motion.div
                  key={`icon-${step}`}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: `color-mix(in srgb, ${current.color} 15%, transparent)` }}
                >
                  <Icon className="h-6 w-6" style={{ color: current.color }} />
                </motion.div>

                {/* Text */}
                <motion.div
                  key={`text-${step}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, duration: 0.24 }}
                >
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    {current.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {current.body}
                  </p>

                  {/* Directional hint */}
                  <div
                    className="mt-3 rounded-lg px-3 py-2 text-xs font-medium"
                    style={{
                      background: `color-mix(in srgb, ${current.color} 8%, transparent)`,
                      color: `color-mix(in srgb, ${current.color} 90%, var(--text-secondary))`,
                      borderLeft: `2px solid ${current.color}`,
                    }}
                  >
                    {current.hint}
                  </div>
                </motion.div>

                {/* Footer */}
                <div className="mt-5 flex items-center justify-between">
                  {/* Step circles */}
                  <div className="flex items-center gap-1.5">
                    {STEPS.map((_, i) => (
                      <div
                        key={i}
                        className="flex h-5 w-5 items-center justify-center rounded-full transition-all duration-300"
                        style={{
                          background: i < step
                            ? `color-mix(in srgb, ${current.color} 20%, transparent)`
                            : i === step
                            ? `color-mix(in srgb, ${current.color} 15%, transparent)`
                            : "var(--bg-surface-raised)",
                        }}
                      >
                        {i < step ? (
                          <Check className="h-2.5 w-2.5" style={{ color: current.color }} />
                        ) : (
                          <span
                            className="text-[9px] font-bold"
                            style={{ color: i === step ? current.color : "var(--text-muted)" }}
                          >
                            {i + 1}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={advance}
                    size="sm"
                    className="gap-1.5 text-xs font-semibold"
                    style={{
                      background: current.color,
                      color: "white",
                    }}
                  >
                    {current.cta}
                    {!isLast && <ArrowRight className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
