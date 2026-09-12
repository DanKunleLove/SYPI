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
  Package,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { SaveTemplateDialog } from "@/components/editor/save-template-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCanvasExport } from "@/hooks/use-canvas-export";
import { serializeCanvasForAI } from "@/lib/ai/canvas-context";
import { generateSpecMarkdown } from "@/lib/spec";
import {
  downloadAgentBundle,
  downloadSpiSchema,
  downloadSystemKit,
  generateLovablePrompt,
  generateMermaid,
  generateSpiSchema,
  generateV0Prompt,
  parseSpiSchema,
} from "@/lib/export";
import {
  KIT_DOMAINS,
  KIT_PROFILES,
  getKitDomain,
  kitEntryFile,
  type KitDomainId,
  type KitProfileId,
} from "@/lib/ai/kit";
import { recordEvent } from "@/lib/events";
import type { CanvasNode, CanvasEdge } from "@/types/canvas";
import { ExportRow } from "./export-row";
import { ScenarioMatrix } from "./scenario-matrix";

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
  const [bundling, setBundling] = useState(false);
  const [showExports, setShowExports] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const { exportPng, exporting } = useCanvasExport(projectName);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);

  // System Kit — the proper-system files, generated from the canvas.
  const [kitFiles, setKitFiles] = useState<Record<string, string>>({});
  const [kitCurrent, setKitCurrent] = useState<string | null>(null);
  const [kitBusy, setKitBusy] = useState(false);
  const [kitError, setKitError] = useState<string | null>(null);
  const [kitProfiles, setKitProfiles] = useState<KitProfileId[]>(() => {
    if (typeof window === "undefined") return ["claude-code"];
    try {
      const saved = JSON.parse(localStorage.getItem("spi-kit-profiles") ?? "");
      if (Array.isArray(saved)) {
        const valid = saved.filter((id): id is KitProfileId =>
          KIT_PROFILES.some((p) => p.id === id)
        );
        if (valid.length > 0) return valid;
      }
    } catch {
      // Fall through to the default.
    }
    return ["claude-code"];
  });

  const toggleKitProfile = useCallback((id: KitProfileId) => {
    setKitProfiles((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      localStorage.setItem("spi-kit-profiles", JSON.stringify(next));
      return next;
    });
  }, []);

  const [kitDomainId, setKitDomainId] = useState<KitDomainId>(() => {
    if (typeof window === "undefined") return "software";
    const saved = localStorage.getItem("spi-kit-domain");
    return KIT_DOMAINS.some((d) => d.id === saved) ? (saved as KitDomainId) : "software";
  });
  const kitDomain = getKitDomain(kitDomainId);

  const selectKitDomain = useCallback((id: KitDomainId) => {
    setKitDomainId(id);
    localStorage.setItem("spi-kit-domain", id);
  }, []);

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
      // Graceful: keep the deterministic spec without an AI overview.
    } finally {
      setEnhancing(false);
    }
  }, [nodes, edges, projectId]);

  const handleGenerateKit = useCallback(async () => {
    setKitBusy(true);
    setKitError(null);
    setKitFiles({});
    try {
      const canvasContext = serializeCanvasForAI(nodes, edges);
      const res = await fetch("/api/ai/kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, canvasContext, projectName, domain: kitDomain.id }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate the kit");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const collected: Record<string, string> = {};

      const handleLine = (raw: string) => {
        if (!raw.trim()) return;
        const event = JSON.parse(raw) as {
          type: "start" | "file" | "done" | "error";
          name?: string;
          content?: string;
          error?: string;
        };
        if (event.type === "start" && event.name) {
          setKitCurrent(event.name);
        } else if (event.type === "file" && event.name && event.content) {
          collected[event.name] = event.content;
          setKitFiles({ ...collected });
        } else if (event.type === "error") {
          throw new Error(event.error || "Kit generation failed");
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const rawLine = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          handleLine(rawLine);
        }
      }
      if (buffer.trim()) handleLine(buffer);

      if (Object.keys(collected).length < kitDomain.files.length) {
        throw new Error("Kit generation ended early — please retry");
      }

      await downloadSystemKit(
        collected,
        kitEntryFile(projectName, kitDomain),
        nodes,
        edges,
        projectName,
        kitProfiles,
        kitDomain
      );
      toast.success("System Kit downloaded", {
        description: "Drop the files into your repo — your AI tools read their setup natively.",
      });
    } catch (error) {
      setKitError(error instanceof Error ? error.message : "Kit generation failed");
    } finally {
      setKitBusy(false);
      setKitCurrent(null);
    }
  }, [nodes, edges, projectId, projectName, kitProfiles, kitDomain]);

  const handleAgentBundle = useCallback(async () => {
    setBundling(true);
    try {
      await downloadAgentBundle(nodes, edges, projectName, spec);
      recordEvent("bundle_exported");
    } finally {
      setBundling(false);
    }
  }, [nodes, edges, projectName, spec]);

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
            setImportError("Invalid spi-schema.json — check the file format.");
            return;
          }
          // Clear existing canvas and load the imported architecture
          const currentNodes = reactFlow.getNodes();
          const currentEdges = reactFlow.getEdges();
          if (currentNodes.length > 0) {
            reactFlow.deleteElements({ nodes: currentNodes, edges: currentEdges });
          }
          if (schema.nodes.length > 0) {
            reactFlow.addNodes(
              schema.nodes.map((n) => ({
                ...n,
                type: n.type || "systemNode",
              }))
            );
          }
          if (schema.edges.length > 0) {
            reactFlow.addEdges(schema.edges.map((e) => ({ ...e, type: e.type || "custom" })));
          }
          setTimeout(() => reactFlow.fitView({ duration: 400 }), 100);
        } catch {
          setImportError("Could not parse file — make sure it's valid JSON.");
        }
        // Reset input so the same file can be re-imported
        if (importRef.current) importRef.current.value = "";
      };
      reader.readAsText(file);
    },
    [reactFlow]
  );

  if (nodeCount === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-ai)]/10">
          <FileText className="h-6 w-6 text-[var(--accent-ai)]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">Spec &amp; Export</p>
          <p className="mt-1 max-w-[240px] text-xs text-[var(--text-muted)]">
            Build your canvas to generate specs, export images, and create AI agent bundles.
          </p>
        </div>
        {/* Import even when canvas is empty */}
        <div className="w-full border-t border-[var(--border-default)] pt-4">
          <input ref={importRef} type="file" accept=".json" aria-label="Import spi-schema.json" className="hidden" onChange={handleImport} />
          <Button
            onClick={() => importRef.current?.click()}
            variant="ghost"
            className="w-full gap-2 border border-dashed border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] hover:border-[var(--accent-ai)]/40 hover:text-[var(--accent-ai)]"
          >
            <Upload className="h-3.5 w-3.5" />
            Import spi-schema.json
          </Button>
          {importError && (
            <p className="mt-2 text-center text-[11px] text-[var(--state-error)]">{importError}</p>
          )}
        </div>
      </div>
    );
  }

  const mermaid = generateMermaid(nodes, edges);
  const lovablePrompt = generateLovablePrompt(nodes, edges, projectName);
  const v0Prompt = generateV0Prompt(nodes, edges, projectName);

  return (
    <>
      {/* Spec preview */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <pre className="whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {spec}
        </pre>
      </div>

      {/* Primary actions */}
      <div className="border-t border-[var(--border-default)] p-3 shrink-0 space-y-2">
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

        {/* Failure scenarios — deterministic, no model call */}
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
          <ScenarioMatrix projectId={projectId} />
        </div>

        {/* System Kit — the hero export */}
        <div className="rounded-lg border border-[var(--accent-ai)]/25 bg-[var(--accent-ai)]/5 p-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-ai)]/15">
              <Package className="h-3.5 w-3.5 text-[var(--accent-ai)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--text-primary)]">System Kit</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                The proper system — overview, structure, standards, workflow rules,
                tracker — generated from this canvas for the kind of work you&apos;re doing.
                Leave with a system, not just a diagram.
              </p>
            </div>
          </div>

          {/* Domain — which kind of system this canvas describes */}
          <div className="mt-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              What are you building?
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {KIT_DOMAINS.map((domain) => {
                const active = kitDomainId === domain.id;
                return (
                  <button
                    key={domain.id}
                    type="button"
                    onClick={() => selectKitDomain(domain.id)}
                    title={domain.hint}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                      active
                        ? "border-[var(--accent-ai)]/50 bg-[var(--accent-ai)]/15 text-[var(--accent-ai)]"
                        : "border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--border-subtle)] hover:text-[var(--text-secondary)]"
                    )}
                  >
                    {domain.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Platform profiles — only code-tool domains have tool-native files */}
          {kitDomain.codeProfiles ? (
            <div className="mt-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Where will you build?
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {KIT_PROFILES.map((profile) => {
                  const active = kitProfiles.includes(profile.id);
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => toggleKitProfile(profile.id)}
                      title={`Adds ${profile.hint}`}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                        active
                          ? "border-[var(--accent-ai)]/50 bg-[var(--accent-ai)]/15 text-[var(--accent-ai)]"
                          : "border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--border-subtle)] hover:text-[var(--text-secondary)]"
                      )}
                    >
                      {profile.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                AGENTS.md, context files &amp; .env template are always included.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-[var(--text-muted)]">
              Includes a paste-ready KNOWLEDGE.md for ChatGPT/Claude/Gemini plus a
              prompting guide, context files &amp; tool setup.
            </p>
          )}
          {kitBusy && (
            <div className="mt-2.5 space-y-1">
              {kitDomain.files.map((f) => {
                const isDone = kitFiles[f.name] !== undefined;
                const isCurrent = kitCurrent === f.name && !isDone;
                return (
                  <div key={f.name} className="flex items-center gap-1.5 text-[11px]">
                    {isDone ? (
                      <Check className="h-3 w-3 text-[var(--state-success)]" />
                    ) : isCurrent ? (
                      <Loader2 className="h-3 w-3 animate-spin text-[var(--accent-ai)]" />
                    ) : (
                      <span className="h-3 w-3 rounded-full border border-[var(--border-default)]" />
                    )}
                    <span
                      className={cn(
                        isDone || isCurrent
                          ? "text-[var(--text-secondary)]"
                          : "text-[var(--text-muted)]"
                      )}
                    >
                      {f.title}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {kitError && (
            <p className="mt-2 text-[11px] text-[var(--state-error)]">{kitError}</p>
          )}
          <Button
            onClick={handleGenerateKit}
            disabled={kitBusy}
            className="mt-2.5 w-full gap-1.5 bg-[var(--accent-ai)] text-xs text-white hover:bg-[var(--accent-ai)]/90 disabled:opacity-50"
          >
            {kitBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Package className="h-3.5 w-3.5" />
            )}
            {kitBusy ? "Generating your system…" : "Generate System Kit (.zip)"}
          </Button>
        </div>

        {/* Save as template */}
        <Button
          onClick={() => setSaveTemplateOpen(true)}
          variant="ghost"
          className="w-full gap-1.5 border border-[var(--border-default)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Save as template
        </Button>

        {/* Export formats toggle */}
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
            {/* PNG */}
            <ExportRow
              icon={Image}
              label="PNG Image"
              description="High-res diagram for slides & docs"
              actionLabel={exporting ? "Exporting…" : "Download"}
              loading={exporting}
              onClick={() => {
                recordEvent("png_exported");
                exportPng();
              }}
            />

            {/* Mermaid */}
            <ExportRow
              icon={Code2}
              label="Mermaid Diagram"
              description="Flowchart for GitHub & Notion"
              actionLabel="Download .mmd"
              onCopy={() => copyText(mermaid, "mermaid")}
              copied={copiedKey === "mermaid"}
              onClick={handleDownloadMermaid}
            />

            {/* Agent Bundle */}
            <ExportRow
              icon={Package}
              label="Agent Bundle"
              description="CLAUDE.md + schema + tasks (.zip)"
              actionLabel={bundling ? "Bundling…" : "Download .zip"}
              loading={bundling}
              onClick={handleAgentBundle}
            />

            {/* Lovable */}
            <ExportRow
              icon={Zap}
              label="For Lovable"
              description="Ready-to-paste build prompt"
              actionLabel="Copy"
              onCopy={() => copyText(lovablePrompt, "lovable")}
              copied={copiedKey === "lovable"}
            />

            {/* v0 */}
            <ExportRow
              icon={Sparkles}
              label="For v0"
              description="Component-focused build prompt"
              actionLabel="Copy"
              onCopy={() => copyText(v0Prompt, "v0")}
              copied={copiedKey === "v0"}
            />

            {/* Schema */}
            <ExportRow
              icon={FileText}
              label="spi-schema.json"
              description="Raw canvas data — re-import anytime"
              actionLabel="Download"
              onClick={() => downloadSpiSchema(nodes, edges, projectName)}
            />
          </div>
        )}

        {/* Import */}
        <div>
          <input ref={importRef} type="file" accept=".json" aria-label="Import spi-schema.json" className="hidden" onChange={handleImport} />
          <Button
            onClick={() => { setImportError(null); importRef.current?.click(); }}
            variant="ghost"
            className="w-full gap-2 border border-dashed border-[var(--border-default)] text-xs text-[var(--text-muted)] hover:border-[var(--accent-ai)]/40 hover:text-[var(--accent-ai)]"
          >
            <Upload className="h-3.5 w-3.5" />
            Import spi-schema.json
          </Button>
          {importError && (
            <p className="mt-1.5 text-center text-[11px] text-[var(--state-error)]">{importError}</p>
          )}
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
