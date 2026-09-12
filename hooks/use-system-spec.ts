"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Spec head for the AI panel. Deliberately small: the full document stays on the
 * server, because nothing in the UI needs it and it is large.
 */

export interface SpecDecision {
  id: string;
  question: string;
  why: string;
  category: string;
  severity: "blocking" | "material" | "cosmetic";
  options: { label: string; implication: string; isDefault: boolean }[];
}

export interface SpecHead {
  exists: boolean;
  version?: number;
  completeness?: number;
  tier?: number;
  tierLabel?: string;
  tierRationale?: string;
  productTitle?: string | null;
  counts?: {
    requirements: number;
    components: number;
    openDecisions: number;
    material: number;
  };
  decisions?: SpecDecision[];
  integrity?: { rule: string; severity: string; message: string }[];
}

export function useSystemSpec(projectId: string) {
  const [spec, setSpec] = useState<SpecHead | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/uss/${projectId}`);
      if (!res.ok) {
        setSpec({ exists: false });
        return;
      }
      setSpec((await res.json()) as SpecHead);
    } catch {
      // A spec that will not load must never break the panel.
      setSpec({ exists: false });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { spec, loading, refresh };
}
