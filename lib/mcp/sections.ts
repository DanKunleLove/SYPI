import type { Uss } from "@/lib/uss/schema";
import {
  architecture,
  domainEntities,
  invariants,
  materialOpenDecisions,
  nonFunctional,
  requirements,
} from "@/lib/uss/views";

/**
 * Readable slices of the specification for an MCP host.
 *
 * The whole USS is large and almost none of it helps a conversation, so a host
 * asks for one section at a time and pages through it. Entities are projected
 * to the fields a person (or a model relaying to one) can use; provenance is
 * reduced to status and confidence rather than the full evidence trail.
 */

export const SECTION_NAMES = [
  "requirements",
  "architecture",
  "decisions",
  "risks",
  "domain",
] as const;
export type SectionName = (typeof SECTION_NAMES)[number];

export const MAX_PAGE = 25;
export const DEFAULT_PAGE = 15;

const TEXT_KEYS = [
  "statement",
  "description",
  "question",
  "why",
  "problem",
  "rationale",
  "responsibility",
  "technology",
  "category",
  "requirementKind",
  "priority",
] as const;

/** Project any entity to the readable fields it has. */
export function brief(entity: unknown): Record<string, unknown> {
  const e = entity as Record<string, unknown>;
  const out: Record<string, unknown> = { id: e.id, kind: e.kind, title: e.title };
  for (const key of TEXT_KEYS) {
    const v = e[key];
    if (typeof v === "string" && v.length > 0) out[key] = v.length > 600 ? `${v.slice(0, 600)}…` : v;
  }
  if (Array.isArray(e.acceptanceCriteria) && e.acceptanceCriteria.length > 0) {
    out.acceptanceCriteria = e.acceptanceCriteria;
  }
  if (typeof e.status === "string") out.status = e.status;
  if (typeof e.confidence === "number") out.confidence = e.confidence;
  return out;
}

function itemsFor(doc: Uss, section: SectionName): unknown[] {
  switch (section) {
    case "requirements":
      return [...requirements(doc), ...nonFunctional(doc)];
    case "architecture": {
      const a = architecture(doc);
      return [...a.components];
    }
    case "decisions":
      return materialOpenDecisions(doc);
    case "risks":
      // Severity-ordered so the first page is the one worth reading.
      return [...doc.integrity].sort(
        (a, b) => rank(a.severity) - rank(b.severity)
      );
    case "domain":
      return [...domainEntities(doc), ...invariants(doc)];
  }
}

function rank(severity: string): number {
  return severity === "blocking" ? 0 : severity === "material" ? 1 : 2;
}

export function readSection(
  doc: Uss,
  section: SectionName,
  offset: number,
  limit: number
): { total: number; items: Record<string, unknown>[]; nextOffset: number | null } {
  const all = itemsFor(doc, section);
  const start = Math.max(0, Math.floor(offset) || 0);
  const size = Math.min(MAX_PAGE, Math.max(1, Math.floor(limit) || DEFAULT_PAGE));
  const slice = all.slice(start, start + size);
  const next = start + size;
  return {
    total: all.length,
    items: slice.map(section === "risks" ? (f) => ({ ...(f as object) }) : brief),
    nextOffset: next < all.length ? next : null,
  };
}
