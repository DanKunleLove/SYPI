"use client";

import { useCallback, useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Download, FileJson, Loader2, Package, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateSpecMarkdown } from "@/lib/spec";
import {
  downloadAgentBundle,
  downloadSpiSchema,
  generateLovablePrompt,
  generateSpiSchema,
  generateV0Prompt,
} from "@/lib/export";
import { recordEvent } from "@/lib/events";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";
import { ExportRow } from "./export-row";

export function AgentBundleCard({ projectName }: { projectName: string }) {
  const reactFlow = useReactFlow();
  const [bundling, setBundling] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const nodes = reactFlow.getNodes() as CanvasNode[];
  const edges = reactFlow.getEdges() as CanvasEdge[];
  const spec = useMemo(
    () =>
      generateSpecMarkdown({
        projectName,
        nodes,
        edges,
        date: new Date().toISOString().slice(0, 10),
      }),
    [edges, nodes, projectName]
  );

  const copyText = useCallback(async (text: string, key: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800);
  }, []);

  const handleAgentBundle = useCallback(async () => {
    setBundling(true);
    try {
      await downloadAgentBundle(nodes, edges, projectName, spec);
      recordEvent("bundle_exported");
    } finally {
      setBundling(false);
    }
  }, [edges, nodes, projectName, spec]);

  const lovablePrompt = generateLovablePrompt(nodes, edges, projectName);
  const v0Prompt = generateV0Prompt(nodes, edges, projectName);

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-primary)]/15">
          <Package className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--text-primary)]">Quick Agent Bundle</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
            Fast canvas-based exports for coding agents and app builders. Use the
            System Kit when you want the fuller working-context package.
          </p>
        </div>
      </div>

      <Button
        type="button"
        onClick={handleAgentBundle}
        disabled={bundling || nodes.length === 0}
        className="mt-3 w-full gap-1.5 bg-[var(--accent-primary)] text-xs text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
      >
        {bundling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {bundling ? "Bundling..." : "Download Agent Bundle"}
      </Button>

      <div className="mt-3 space-y-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-2">
        <ExportRow
          icon={Zap}
          label="For Lovable"
          description="Ready-to-paste build prompt"
          actionLabel="Copy"
          onCopy={() => copyText(lovablePrompt, "lovable")}
          copied={copiedKey === "lovable"}
        />
        <ExportRow
          icon={Sparkles}
          label="For v0"
          description="Component-focused build prompt"
          actionLabel="Copy"
          onCopy={() => copyText(v0Prompt, "v0")}
          copied={copiedKey === "v0"}
        />
        <ExportRow
          icon={FileJson}
          label="spi-schema.json"
          description="Raw canvas data, re-import anytime"
          actionLabel="Download"
          onClick={() => downloadSpiSchema(nodes, edges, projectName)}
        />
        <ExportRow
          icon={Package}
          label="Schema Preview"
          description={`${generateSpiSchema(nodes, edges, projectName).nodes.length} nodes, ${edges.length} edges`}
          actionLabel="Copy"
          onCopy={() =>
            copyText(JSON.stringify(generateSpiSchema(nodes, edges, projectName), null, 2), "schema")
          }
          copied={copiedKey === "schema"}
        />
      </div>
    </div>
  );
}
