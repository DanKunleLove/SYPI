import { EXECUTION_TARGETS, getTarget, isTargetId, type ExecutionTarget } from "@/lib/uss/targets";
import type { Uss } from "@/lib/uss/schema";

/**
 * Hand-off files for an MCP host, from a pinned spec version.
 *
 * Only DETERMINISTIC files are served here: they are a rendering of the graph,
 * so the same version always yields the same bytes and a read tool makes no
 * model call. Files that need a model are listed in the manifest as
 * `generated` and left to the app's per-file, quota-accounted hand-off run —
 * a read must never hide several model calls behind it.
 */

export const TARGET_IDS = EXECUTION_TARGETS.map((t) => t.id);

export interface HandoffManifestEntry {
  path: string;
  title: string;
  kind: "deterministic" | "generated";
}

export function handoffManifest(target: ExecutionTarget): HandoffManifestEntry[] {
  return target.files.map((f) => ({
    path: f.path,
    title: f.title,
    kind: f.render ? "deterministic" : "generated",
  }));
}

export function resolveTarget(id: unknown): ExecutionTarget | null {
  return isTargetId(id) ? getTarget(id) : null;
}

export type FileResult =
  | { ok: true; path: string; title: string; content: string }
  | { ok: false; reason: "no-such-file" | "needs-generation" };

export function renderHandoffFile(
  doc: Uss,
  target: ExecutionTarget,
  path: string,
  projectName: string
): FileResult {
  const file = target.files.find((f) => f.path === path);
  if (!file) return { ok: false, reason: "no-such-file" };
  if (!file.render) return { ok: false, reason: "needs-generation" };
  return { ok: true, path: file.path, title: file.title, content: file.render(doc, projectName) };
}
