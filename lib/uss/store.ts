import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { createEmptySpec } from "@/lib/uss/empty";
import { normaliseComplexity } from "@/lib/uss/complexity";
import { materialOpenDecisions, specCoverage } from "@/lib/uss/views";
import { USS_VERSION, UssSchema, type Uss } from "@/lib/uss/schema";

/**
 * Persistence for the USS: a head document plus an immutable version log.
 *
 * Two guarantees live here rather than anywhere else:
 *   1. Optimistic concurrency — a write pinned to a version fails rather than
 *      clobbering a concurrent one.
 *   2. Epistemic honesty — `KNOWN` with no evidence is downgraded on the way in,
 *      so a model cannot assert its way to certainty no matter what it emits.
 */

/** Refuse absurd documents rather than letting jsonb rows grow unbounded. */
const MAX_DOC_BYTES = 600_000;

export type SpecSource = "extract" | "answer" | "canvas-sync" | "manual" | "import";

export interface SpecRecord {
  doc: Uss;
  version: number;
  updatedAt: Date;
}

export class SpecConflictError extends Error {
  constructor(
    readonly expected: number,
    readonly actual: number
  ) {
    super(`Spec changed since you read it (expected v${expected}, found v${actual})`);
    this.name = "SpecConflictError";
  }
}

/**
 * Parse a stored document, fail-soft.
 *
 * Returns null rather than throwing when the row is from a newer schema version
 * or is corrupt, so every consumer falls back to the canvas path instead of the
 * app breaking. jsonb enforces nothing; this function is the enforcement.
 */
export function parseUss(raw: unknown, schemaVersion: number): Uss | null {
  if (schemaVersion > USS_VERSION) return null; // written by a newer deploy
  const parsed = UssSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Enforce the provenance rule on the way in. A model may claim anything; it may
 * not make a claim STICK without evidence.
 */
export function enforceProvenance(doc: Uss): Uss {
  const fix = <T extends { status: string; confidence: number; evidence: unknown[] }>(x: T): T =>
    x.status === "KNOWN" && x.evidence.length === 0
      ? { ...x, status: "INFERRED", confidence: Math.min(x.confidence, 0.5) }
      : x;

  return {
    ...doc,
    complexity: normaliseComplexity(fix(doc.complexity)),
    entities: doc.entities.map(fix),
    relations: doc.relations.map(fix),
  };
}

export async function getSpec(projectId: string): Promise<SpecRecord | null> {
  const row = await prisma.systemSpec.findUnique({ where: { projectId } });
  if (!row) return null;
  const doc = parseUss(row.doc, row.schemaVersion);
  if (!doc) return null;
  return { doc, version: row.version, updatedAt: row.updatedAt };
}

/** Get the spec, creating an empty one if the project has none yet. */
export async function getOrCreateSpec(
  projectId: string,
  domain?: Uss["domain"]
): Promise<SpecRecord> {
  const existing = await getSpec(projectId);
  if (existing) return existing;

  const doc = createEmptySpec({ specId: `spec_${projectId}`, projectId, domain });
  const row = await prisma.systemSpec.create({
    data: {
      projectId,
      schemaVersion: USS_VERSION,
      version: 1,
      doc: doc as unknown as Prisma.InputJsonValue,
      complexityTier: doc.complexity.tier,
      // Prisma column, deliberately NOT renamed: it is a denormalised mirror of
      // meta.coverage and renaming it would cost a migration for no benefit.
      completeness: 0,
      openDecisions: 0,
      domain: doc.domain,
    },
  });
  return { doc, version: row.version, updatedAt: row.updatedAt };
}

/**
 * Write a new head version.
 *
 * Pass `ifVersion` (the version you read) to make the write conditional: if
 * anyone else committed in between, this throws SpecConflictError rather than
 * silently discarding their work, and the caller re-reads and re-applies.
 */
export async function commitSpec(params: {
  projectId: string;
  doc: Uss;
  source: SpecSource;
  changeSummary: string;
  authorUserId?: string;
  ifVersion?: number;
}): Promise<SpecRecord> {
  const clean = enforceProvenance(params.doc);

  const validated = UssSchema.safeParse(clean);
  if (!validated.success) {
    // Referential integrity and duplicate ids are rejected here, not written and
    // reported later. A corrupt graph is not a finding — it is a bug.
    throw new Error(
      `Refusing to write an invalid spec: ${validated.error.issues
        .slice(0, 3)
        .map((i) => i.message)
        .join("; ")}`
    );
  }
  const doc = validated.data;

  const serialised = JSON.stringify(doc);
  if (serialised.length > MAX_DOC_BYTES) {
    throw new Error(
      `Spec is ${Math.round(serialised.length / 1024)}KB, over the ${MAX_DOC_BYTES / 1024}KB limit`
    );
  }

  const material = materialOpenDecisions(doc).length;

  return prisma.$transaction(async (tx) => {
    const current = await tx.systemSpec.findUnique({
      where: { projectId: params.projectId },
      select: { id: true, version: true },
    });

    if (!current) {
      const created = await tx.systemSpec.create({
        data: {
          projectId: params.projectId,
          schemaVersion: USS_VERSION,
          version: 1,
          doc: doc as unknown as Prisma.InputJsonValue,
          complexityTier: doc.complexity.tier,
          completeness: specCoverage(doc),
          openDecisions: material,
          domain: doc.domain,
        },
      });
      await tx.systemSpecVersion.create({
        data: {
          specId: created.id,
          version: 1,
          doc: doc as unknown as Prisma.InputJsonValue,
          changeSummary: params.changeSummary,
          source: params.source,
          authorUserId: params.authorUserId,
        },
      });
      return { doc, version: 1, updatedAt: created.updatedAt };
    }

    if (params.ifVersion !== undefined && current.version !== params.ifVersion) {
      throw new SpecConflictError(params.ifVersion, current.version);
    }

    const nextVersion = current.version + 1;
    const updated = await tx.systemSpec.update({
      where: { id: current.id },
      data: {
        schemaVersion: USS_VERSION,
        version: nextVersion,
        doc: doc as unknown as Prisma.InputJsonValue,
        complexityTier: doc.complexity.tier,
        completeness: specCoverage(doc),
        openDecisions: material,
        domain: doc.domain,
      },
    });
    await tx.systemSpecVersion.create({
      data: {
        specId: current.id,
        version: nextVersion,
        doc: doc as unknown as Prisma.InputJsonValue,
        changeSummary: params.changeSummary,
        source: params.source,
        authorUserId: params.authorUserId,
      },
    });

    return { doc, version: nextVersion, updatedAt: updated.updatedAt };
  });
}

/**
 * Commit with automatic retry on conflict: re-read, re-apply, write again.
 * Answering decisions is commutative enough for this to be safe, and it means two
 * collaborators answering different questions both land.
 */
export async function commitWithRetry(params: {
  projectId: string;
  source: SpecSource;
  changeSummary: string;
  authorUserId?: string;
  apply: (current: Uss) => Uss | Promise<Uss>;
  attempts?: number;
}): Promise<SpecRecord> {
  const attempts = params.attempts ?? 3;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    const current = await getOrCreateSpec(params.projectId);
    try {
      const next = await params.apply(current.doc);
      return await commitSpec({
        projectId: params.projectId,
        doc: next,
        source: params.source,
        changeSummary: params.changeSummary,
        authorUserId: params.authorUserId,
        ifVersion: current.version,
      });
    } catch (e) {
      lastError = e;
      if (!(e instanceof SpecConflictError)) throw e;
    }
  }
  throw lastError;
}

export async function listVersions(projectId: string, take = 20) {
  const spec = await prisma.systemSpec.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (!spec) return [];
  return prisma.systemSpecVersion.findMany({
    where: { specId: spec.id },
    orderBy: { version: "desc" },
    take,
    select: {
      version: true,
      changeSummary: true,
      source: true,
      createdAt: true,
      authorUserId: true,
    },
  });
}
