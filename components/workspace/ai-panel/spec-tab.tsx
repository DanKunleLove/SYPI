"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Download,
  FileText,
  Image,
  LayoutTemplate,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { SaveTemplateDialog } from "@/components/editor/save-template-dialog";
import { Button } from "@/components/ui/button";
import { useCanvasExport } from "@/hooks/use-canvas-export";
import { serializeCanvasForAI } from "@/lib/ai/canvas-context";
import { recordEvent } from "@/lib/events";
import {
  downloadSpiSchema,
  generateMermaid,
  generateSpiSchema,
  parseSpiSchema,
} from "@/lib/export";
import { generateSpecMarkdown } from "@/lib/spec";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";
import { ExportRow } from "./export-row";

export function SpecTab({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const reactFlow = useReactFlow();
  const [overview, setOverview] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showExports, setShowExports] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const { exportPng, exporting } = useCanvasExport(projectName);

  const nodeCount = reactFlow.getNodes().length;
  const nodes = reactFlow.getNodes() as CanvasNode[];
  const edges = reactFlow.getEdges() as CanvasEdge[];

  const spec = useMemo(
    () =>
      generateSpecMarkdown({
        projectName,
        nodes,
        edges,
        overview: overview ?? undefined,
        date: new Date().toISOString().slice(0, 10),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reactFlow, projectName, overview, nodeCount]
  );

  const copyText = useCallback(async (text: string, key: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800);
  }, []);

  const handleDownloadMd = useCallback(() => {
    const blob = new Blob([spec], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (projectName || "architecture").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.href = url;
    a.download = `${safe}-spec.md`;
    a.click();
    URL.revokeObjectURL(url);
    recordEvent("spec_exported");
  }, [spec, projectName]);

  const handleDownloadMermaid = useCallback(() => {
    const mermaid = generateMermaid(nodes, edges);
    const blob = new Blob([mermaid], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (projectName || "architecture").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.href = url;
    a.download = `${safe}-diagram.mmd`;
    a.click();
    URL.revokeObjectURL(url);
    recordEvent("mermaid_exported");
  }, [nodes, edges, projectName]);

  const handleEnhance = useCallback(async () => {
    setEnhancing(true);
    try {
      const canvasContext = serializeCanvasForAI(nodes, edges);
      const res = await fetch("/api/ai/spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, canvasContext }),
      });
      if (!res.ok) throw new Error("Failed to enhance");
      const data = await res.json();
      if (typeof data.overview === "string") setOverview(data.overview);
    } catch {
      // Keep the deterministic spec if AI enhancement fails.
    } finally {
      setEnhancing(false);
    }
  }, [nodes, edges, projectId]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setImportError(null);
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target?.result as string);
          const schema = parseSpiSchema(json);
          if (!schema) {
            setImportError("Invalid spi-schema.json. Check the file format.");
            return;
          }
          const currentNodes = reactFlow.getNodes();
          const currentEdges = reactFlow.getEdges();
          if (currentNodes.length > 0) {
            reactFlow.deleteElements({ nodes: currentNodes, edges: currentEdges });
          }
          if (schema.nodes.length > 0) {
            reactFlow.addNodes(schema.nodes.map((n) => ({ ...n, type: n.type || "systemNode" })));
          }
          if (schema.edges.length > 0) {
            reactFlow.addEdges(schema.edges.map((e) => ({ ...e, type: e.type || "custom" })));
          }
          setTimeout(() => reactFlow.fitView({ duration: 400 }), 100);
        } catch {
          setImportError("Could not parse file. Make sure it is valid JSON.");
        }
        if (importRef.current) importRef.current.value = "";
      };
      reader.readAsText(file);
    },
    [reactFlow]
  );

  if (nodeCount === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-ai)]/10">
          <FileText className="h-6 w-6 text-[var(--accent-ai)]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">Spec &amp; Export</p>
          <p className="mt-1 max-w-[240px] text-xs text-[var(--text-muted)]">
            Build your canvas to generate readable specs, diagrams, and portable schemas.
          </p>
        </div>
        <div className="w-full border-t border-[var(--border-default)] pt-4">
          <input
            ref={importRef}
            type="file"
            accept=".json"
            aria-label="Import spi-schema.json"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            onClick={() => importRef.current?.click()}
            variant="ghost"
            className="w-full gap-2 border border-dashed border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:border-[var(--accent-ai)]/40 hover:text-[var(--accent-ai)]"
          >
            <Upload className="h-3.5 w-3.5" />
            Import spi-schema.json
          </Button>
          {importError && (
            <p className="mt-2 text-center text-[11px] text-[var(--state-error)]">
              {importError}
            </p>
          )}
        </div>
      </div>
    );
  }

  const mermaid = generateMermaid(nodes, edges);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <pre className="max-h-[45vh] shrink-0 overflow-y-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {spec}
        </pre>

        <div className="space-y-2 border-t border-[var(--border-default)] p-3">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleEnhance}
              disabled={enhancing}
              variant="ghost"
              className="gap-1.5 border border-[var(--border-default)] text-xs text-[var(--text-secondary)]"
            >
              {enhancing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent-ai)]" />
              )}
              {overview ? "Re-enhance" : "Enhance with AI"}
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Button
                onClick={() => copyText(spec, "md")}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                title="Copy Markdown"
              >
                {copiedKey === "md" ? (
                  <Check className="h-3.5 w-3.5 text-[var(--state-success)]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                onClick={handleDownloadMd}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                title="Download .md"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Button
            onClick={() => setSaveTemplateOpen(true)}
            variant="ghost"
            className="w-full gap-1.5 border border-[var(--border-default)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            Save as template
          </Button>

          <button
            type="button"
            onClick={() => setShowExports((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
          >
            <span className="font-medium">Export formats</span>
            {showExports ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {showExports && (
            <div className="space-y-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-2">
              <ExportRow
                icon={Image}
                label="PNG Image"
                description="High-res diagram for slides & docs"
                actionLabel={exporting ? "Exporting..." : "Download"}
                loading={exporting}
                onClick={() => {
                  recordEvent("png_exported");
                  exportPng();
                }}
              />
              <ExportRow
                icon={Code2}
                label="Mermaid Diagram"
                description="Flowchart for GitHub & Notion"
                actionLabel="Download .mmd"
                onCopy={() => copyText(mermaid, "mermaid")}
                copied={copiedKey === "mermaid"}
                onClick={handleDownloadMermaid}
              />
              <ExportRow
                icon={FileText}
                label="spi-schema.json"
                description="Raw canvas data. Re-import anytime"
                actionLabel="Download"
                onClick={() => downloadSpiSchema(nodes, edges, projectName)}
              />
            </div>
          )}

          <div>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              aria-label="Import spi-schema.json"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              onClick={() => {
                setImportError(null);
                importRef.current?.click();
              }}
              variant="ghost"
              className="w-full gap-2 border border-dashed border-[var(--border-default)] text-xs text-[var(--text-muted)] hover:border-[var(--accent-ai)]/40 hover:text-[var(--accent-ai)]"
            >
              <Upload className="h-3.5 w-3.5" />
              Import spi-schema.json
            </Button>
            {importError && (
              <p className="mt-1.5 text-center text-[11px] text-[var(--state-error)]">
                {importError}
              </p>
            )}
          </div>
        </div>
      </div>

      <SaveTemplateDialog
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        schema={generateSpiSchema(nodes, edges, projectName)}
      />
    </>
  );
}
