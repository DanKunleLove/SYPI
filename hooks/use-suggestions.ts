"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { analyzePatterns, type Suggestion } from "@/lib/ai/suggestions";
import type { CanvasNode, CanvasEdge } from "@/types/canvas";

const MAX_SUGGESTIONS = 5;
const DEBOUNCE_MS = 3000;

export function useSuggestions() {
  const reactFlow = useReactFlow();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Run rule-based analysis when canvas changes
  const analyze = useCallback(() => {
    const nodes = reactFlow.getNodes() as CanvasNode[];
    const edges = reactFlow.getEdges() as CanvasEdge[];

    if (nodes.length === 0) {
      setSuggestions([]);
      return;
    }

    const ruleSuggestions = analyzePatterns(nodes, edges);
    setSuggestions(ruleSuggestions);
  }, [reactFlow]);

  // Debounced re-analysis
  useEffect(() => {
    // Initial analysis
    analyze();

    // Set up interval-based re-analysis (since we can't directly listen to reactflow changes here)
    const interval = setInterval(analyze, DEBOUNCE_MS);
    return () => clearInterval(interval);
  }, [analyze]);

  const dismiss = useCallback((suggestionId: string) => {
    setDismissedIds((prev) => new Set(prev).add(suggestionId));
  }, []);

  const visibleSuggestions = suggestions
    .filter((s) => !dismissedIds.has(s.id))
    .slice(0, MAX_SUGGESTIONS);

  return {
    suggestions: visibleSuggestions,
    allSuggestions: suggestions,
    dismiss,
    refresh: analyze,
  };
}
