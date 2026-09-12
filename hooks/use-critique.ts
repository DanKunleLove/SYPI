"use client";

import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import type { CritiqueIssue } from "@/lib/ai/schemas";

export type CritiqueStatus = "idle" | "submitting" | "analyzing" | "done" | "error";

interface UseCritiqueOptions {
  projectId: string;
}

export interface ReviewDiscipline {
  id: string;
  label: string;
  reason: string;
}

interface CouncilFinding {
  discipline: string;
  title: string;
  severity: "blocking" | "material" | "cosmetic";
  statement: string;
  failureScenario: string;
  recommendation: string;
}

/** The council speaks in blocking/material/cosmetic; the panel renders the older
 *  critical/warning/suggestion vocabulary. Map rather than rewrite the panel. */
const SEVERITY: Record<string, CritiqueIssue["severity"]> = {
  blocking: "critical",
  material: "warning",
  cosmetic: "suggestion",
};

/**
 * Design review, now the Engineering Council.
 *
 * Previously this triggered a Trigger.dev job and polled for completion, which
 * was the single biggest source of "stuck on analyzing" reports — a queued run
 * with no worker running never completed and never reported why. It now streams
 * from an inline route, so progress is visible and a failure is an error rather
 * than a spinner.
 */
export function useCritique({ projectId }: UseCritiqueOptions) {
  const reactFlow = useReactFlow();
  const [status, setStatus] = useState<CritiqueStatus>("idle");
  const [issues, setIssues] = useState<CritiqueIssue[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [step, setStep] = useState<string>("");
  const [disciplines, setDisciplines] = useState<ReviewDiscipline[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const startCritique = useCallback(async () => {
    if (reactFlow.getNodes().length === 0) {
      toast.error("Nothing to review — add some components first");
      return;
    }

    setStatus("submitting");
    setIssues([]);
    setSummary("");
    setDisciplines([]);
    setStep("Selecting reviewers…");

    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start the review");
      }

      setStatus("analyzing");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleLine = (raw: string) => {
        if (!raw.trim()) return;
        const event = JSON.parse(raw) as {
          type: string;
          message?: string;
          error?: string;
          disciplines?: ReviewDiscipline[];
          findings?: CouncilFinding[];
        };

        if (event.type === "council" && event.disciplines) {
          setDisciplines(event.disciplines);
          setStep(
            `${event.disciplines.length} reviewers: ${event.disciplines.map((d) => d.label).join(", ")}`
          );
        } else if (event.type === "status" && event.message) {
          setStep(event.message);
        } else if (event.type === "result" && event.findings) {
          const mapped: CritiqueIssue[] = event.findings.map((f) => ({
            severity: SEVERITY[f.severity] ?? "suggestion",
            title: f.title,
            description: f.failureScenario
              ? `${f.statement}\n\nHow it fails: ${f.failureScenario}`
              : f.statement,
            affectedNodes: [],
            suggestion: f.recommendation,
            category: "best-practices",
          }));
          setIssues(mapped);
          const blocking = event.findings.filter((f) => f.severity === "blocking").length;
          setSummary(
            mapped.length === 0
              ? "The panel found nothing blocking in this design."
              : `${mapped.length} finding${mapped.length === 1 ? "" : "s"}${blocking ? `, ${blocking} blocking` : ""}`
          );
          setStatus("done");
          setStep("");
          toast.success(
            mapped.length === 0
              ? "Review complete — nothing blocking found"
              : `Review complete — ${mapped.length} finding${mapped.length === 1 ? "" : "s"}`
          );
        } else if (event.type === "error") {
          throw new Error(event.error || "Review failed");
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const raw = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          handleLine(raw);
        }
      }
      if (buffer.trim()) handleLine(buffer);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Review failed";
      setStatus("error");
      setStep("");
      toast.error(msg);
    }
  }, [projectId, reactFlow]);

  // The panel dismisses by index into the VISIBLE list; we track titles so the
  // set stays correct as the list shrinks.
  const visible = issues.filter((i) => !dismissedIds.has(i.title));

  const dismissIssue = useCallback(
    (index: number) => {
      const target = visible[index];
      if (!target) return;
      setDismissedIds((prev) => new Set(prev).add(target.title));
    },
    [visible]
  );

  const focusNode = useCallback(
    (label: string) => {
      const node = reactFlow
        .getNodes()
        .find((n) => String(n.data?.label ?? "").toLowerCase() === label.toLowerCase());
      if (node) {
        reactFlow.setCenter(node.position.x + 100, node.position.y + 50, {
          zoom: 1.2,
          duration: 500,
        });
      }
    },
    [reactFlow]
  );

  return {
    status,
    step,
    disciplines,
    issues: visible,
    summary,
    startCritique,
    dismissIssue,
    focusNode,
  };
}
