import { UssGraph } from "@/lib/uss/graph";
import {
  components,
  domainEntities,
  invariants,
  materialOpenDecisions,
  product,
  providerBindings,
  requirements,
  transitions,
} from "@/lib/uss/views";
import type { Entity, Uss } from "@/lib/uss/schema";

/**
 * The task breakdown — requirements → design → ORDERED TASKS.
 *
 * Kiro's third step, done as a graph query rather than a model call. Every task is
 * derived from something already in the spec, so each one can say which
 * requirements it satisfies, what it waits on, and which open question blocks it.
 * Nothing here is invented; a task with no source in the graph cannot exist.
 *
 * A VIEW, never stored: recomputed from the graph on every read, so it cannot go
 * stale when the canvas or the requirements change.
 *
 * Ordering rule: a component is built after everything it depends on (canvas
 * edges are `dependsOn`, source → target, so the target comes first). Components
 * at the same depth with no edge between them can be built in parallel — the same
 * `[P]` marker GitHub Spec Kit uses.
 */

type Component = Extract<Entity, { kind: "component" }>;

export type TaskKind = "setup" | "component" | "rule" | "lifecycle" | "unassigned";

export interface Task {
  /** T001, T002… assigned in final order, so ids are stable for a given spec. */
  id: string;
  kind: TaskKind;
  title: string;
  detail: string;
  /** Phase number, 1-based. Tasks in one phase never depend on each other. */
  phase: number;
  /** Safe to build alongside the other tasks in its phase. */
  parallel: boolean;
  /** Requirement ids this task delivers. */
  satisfies: string[];
  /** Task ids that must be finished first. */
  dependsOn: string[];
  /** Unresolved decisions that could change this task. Ask before building. */
  blockedBy: { id: string; question: string }[];
  /** How to know it is done — the acceptance criteria of what it satisfies. */
  doneWhen: string[];
  /** The spec entity this task came from. */
  sourceId?: string;
}

export interface TaskPlan {
  tasks: Task[];
  phases: { number: number; title: string }[];
  /** Components caught in a dependency loop — built in canvas order, flagged. */
  cycles: string[];
}

/** Within one phase, stores before logic before edges before clients. */
const CATEGORY_ORDER: Record<string, number> = {
  database: 0,
  storage: 0,
  cache: 1,
  queue: 1,
  service: 2,
  compute: 2,
  gateway: 3,
  client: 4,
  custom: 5,
};

/**
 * Depth of each component in the dependency graph (0 = depends on nothing).
 * Kahn's algorithm; anything left over is in a cycle.
 */
function layer(doc: Uss, comps: Component[]): { depth: Map<string, number>; cycles: string[] } {
  const g = new UssGraph(doc);
  const ids = new Set(comps.map((c) => c.id));
  const needs = new Map<string, Set<string>>();
  for (const c of comps) {
    needs.set(
      c.id,
      new Set(g.from(c.id, "dependsOn").map((r) => r.to).filter((to) => ids.has(to) && to !== c.id))
    );
  }

  const depth = new Map<string, number>();
  let frontier = comps.filter((c) => needs.get(c.id)!.size === 0).map((c) => c.id);
  let level = 0;
  while (frontier.length > 0) {
    for (const id of frontier) depth.set(id, level);
    frontier = comps
      .filter((c) => !depth.has(c.id) && [...needs.get(c.id)!].every((n) => depth.has(n)))
      .map((c) => c.id);
    level++;
  }

  // Cycles: build them after everything else, in canvas order, and say so.
  const cycles = comps.filter((c) => !depth.has(c.id)).map((c) => c.id);
  for (const id of cycles) depth.set(id, level);
  return { depth, cycles };
}

/** "stores orders" → "Stores orders." so details read as sentences. */
function sentence(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const capped = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

export function taskBreakdown(doc: Uss): TaskPlan {
  const g = new UssGraph(doc);
  const comps = components(doc).filter((c) => !c.orphaned);
  const reqs = requirements(doc);
  const reqById = new Map(reqs.map((r) => [r.id, r]));
  const openQs = materialOpenDecisions(doc);

  const criteriaFor = (reqIds: string[]) =>
    reqIds.flatMap((id) => reqById.get(id)?.acceptanceCriteria.map((c) => `${id}: ${c}`) ?? []);
  const blockersFor = (componentIds: string[], reqIds: string[], blockingOnly = false) =>
    openQs
      .filter((d) => !blockingOnly || d.impact.severity === "blocking")
      .filter(
        (d) =>
          d.impact.affectsComponents.some((c) => componentIds.includes(c)) ||
          d.impact.affectsRequirements.some((r) => reqIds.includes(r))
      )
      .map((d) => ({ id: d.id, question: d.question }));

  // Draft tasks keyed by source so dependencies can be wired before ids exist.
  type Draft = Omit<Task, "id" | "dependsOn"> & { key: string; after: string[] };
  const drafts: Draft[] = [];

  // ── Phase 1: setup ─────────────────────────────────────────────────────────
  const stack = [
    ...new Set([
      ...comps.map((c) => c.technology).filter((t): t is string => Boolean(t)),
      ...providerBindings(doc).map((b) => b.providerLabel),
    ]),
  ];
  if (comps.length > 0) {
    drafts.push({
      key: "setup",
      kind: "setup",
      title: "Set up the project",
      detail: stack.length
        ? `Create the repository, environment variables and accounts for: ${stack.slice(0, 10).join(", ")}.`
        : "Create the repository and environment configuration.",
      phase: 1,
      parallel: false,
      satisfies: [],
      after: [],
      blockedBy: [],
      doneWhen: ["The project builds and runs locally with an empty feature set."],
    });
  }

  // ── Components, layered by dependency ──────────────────────────────────────
  const { depth, cycles } = layer(doc, comps);
  const maxDepth = comps.length ? Math.max(...comps.map((c) => depth.get(c.id)!)) : -1;
  const componentPhase = (id: string) => depth.get(id)! + 2; // phase 1 is setup

  const ordered = [...comps].sort(
    (a, b) =>
      depth.get(a.id)! - depth.get(b.id)! ||
      (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9)
  );
  for (const c of ordered) {
    const satisfies = g.from(c.id, "satisfies").map((r) => r.to).filter((id) => reqById.has(id));
    const deps = g.from(c.id, "dependsOn").map((r) => r.to).filter((id) => comps.some((x) => x.id === id));
    const phase = componentPhase(c.id);
    drafts.push({
      key: c.id,
      kind: "component",
      title: `Build ${c.title}`,
      detail: [sentence(c.responsibility), c.technology ? `Using ${c.technology}.` : ""].filter(Boolean).join(" "),
      phase,
      parallel: ordered.filter((o) => componentPhase(o.id) === phase).length > 1,
      satisfies,
      // Direct dependencies only: setup is implied by anything that waits on a component.
      after: (() => {
        const direct = deps.filter((d) => componentPhase(d) < phase);
        return direct.length ? direct : ["setup"];
      })(),
      blockedBy: blockersFor([c.id], satisfies),
      doneWhen: criteriaFor(satisfies),
      sourceId: c.id,
    });
  }

  // ── Business rules: invariants and lifecycles, after the components ────────
  const rulesPhase = maxDepth + 3;
  const managersOf = (entityId: string) => g.sources(entityId, "manages").map((e) => e.id);

  for (const inv of invariants(doc)) {
    const enforcers = g.from(inv.id, "enforcedBy").map((r) => r.to);
    const governed = g.from(inv.id, "governs").map((r) => r.to);
    const owners = enforcers.length ? enforcers : governed.flatMap(managersOf);
    drafts.push({
      key: inv.id,
      kind: "rule",
      title: `Enforce: ${inv.statement}`,
      detail: owners.length
        ? `Enforce in code, not by convention${inv.enforcement ? ` (${inv.enforcement})` : ""}, and add a test that tries to break it.`
        : "Nothing in the design enforces this yet — decide where it lives before building, then add a test that tries to break it.",
      phase: rulesPhase,
      parallel: true,
      satisfies: [],
      after: owners.filter((o) => comps.some((c) => c.id === o)),
      blockedBy: blockersFor(owners, [], true),
      doneWhen: [
        inv.violationConsequence
          ? `A test proves the violation is rejected (otherwise: ${inv.violationConsequence}).`
          : "A test proves a violating operation is rejected.",
      ],
      sourceId: inv.id,
    });
  }

  const allTransitions = transitions(doc);
  for (const entity of domainEntities(doc)) {
    const own = allTransitions.filter((t) => t.entityTitle.toLowerCase() === entity.title.toLowerCase());
    if (own.length === 0) continue;
    const owners = managersOf(entity.id);
    drafts.push({
      key: `lifecycle:${entity.id}`,
      kind: "lifecycle",
      title: `Implement the ${entity.title} lifecycle`,
      detail: `Allowed transitions: ${own
        .map((t) => `${t.from} → ${t.to}${t.guard ? ` (only if ${t.guard})` : ""}`)
        .join("; ")}. Reject every transition not on this list.`,
      phase: rulesPhase,
      parallel: true,
      satisfies: [],
      after: owners.filter((o) => comps.some((c) => c.id === o)),
      blockedBy: blockersFor(owners, [], true),
      doneWhen: [`A test shows an unlisted ${entity.title} transition is rejected.`],
      sourceId: entity.id,
    });
  }

  // ── Requirements nothing in the design delivers ────────────────────────────
  const delivered = new Set(drafts.flatMap((d) => d.satisfies));
  const unassigned = reqs.filter((r) => !delivered.has(r.id));
  for (const r of unassigned) {
    drafts.push({
      key: r.id,
      kind: "unassigned",
      title: `Deliver ${r.id}: ${r.title}`,
      detail: `No component in the design delivers this yet: "${r.statement}". Assign it to one, or add what is missing.`,
      phase: rulesPhase + 1,
      parallel: true,
      satisfies: [r.id],
      after: comps.length ? ["setup"] : [],
      blockedBy: blockersFor([], [r.id]),
      doneWhen: criteriaFor([r.id]),
      sourceId: r.id,
    });
  }

  // ── Assign ids in order, then resolve dependencies ─────────────────────────
  drafts.sort((a, b) => a.phase - b.phase);
  const idOf = new Map<string, string>();
  drafts.forEach((d, i) => idOf.set(d.key, `T${String(i + 1).padStart(3, "0")}`));

  // Renumber phases densely: an empty phase (no rules, say) must not leave a gap.
  const usedPhases = [...new Set(drafts.map((d) => d.phase))].sort((a, b) => a - b);
  const dense = new Map(usedPhases.map((p, i) => [p, i + 1]));

  const tasks: Task[] = drafts.map(({ key, after, ...d }) => ({
    ...d,
    id: idOf.get(key)!,
    phase: dense.get(d.phase)!,
    dependsOn: [...new Set(after.map((k) => idOf.get(k)).filter((x): x is string => Boolean(x)))],
  }));

  const phaseTitle = (original: number): string => {
    if (original === 1) return "Setup";
    if (original === rulesPhase) return "Business rules";
    if (original === rulesPhase + 1) return "Unassigned requirements";
    return original === 2 ? "Foundation" : `Components — layer ${original - 1}`;
  };

  return {
    tasks,
    phases: usedPhases.map((p) => ({ number: dense.get(p)!, title: phaseTitle(p) })),
    cycles,
  };
}

/**
 * tasks.md — Spec Kit's task-list shape, so the file drops into a Spec Kit
 * workflow unchanged: `- [ ] T001 [P] description`.
 */
export function renderTasksMarkdown(doc: Uss): string {
  const plan = taskBreakdown(doc);
  const name = product(doc)?.title ?? "this system";
  const lines: string[] = [`# Tasks: ${name}`, ""];

  if (plan.tasks.length === 0) {
    lines.push("No tasks yet — the specification has no components or requirements to build from.");
    return lines.join("\n");
  }

  lines.push(
    "Derived from the SYPI specification. Each task names the requirements it delivers,",
    "what must be finished first, and any open question that could change it.",
    "`[P]` = can be built in parallel with the other `[P]` tasks in its phase.",
    ""
  );

  for (const phase of plan.phases) {
    lines.push(`## Phase ${phase.number}: ${phase.title}`, "");
    for (const t of plan.tasks.filter((x) => x.phase === phase.number)) {
      const tags = [t.parallel ? "[P]" : "", ...t.satisfies.map((s) => `[${s}]`)].filter(Boolean).join(" ");
      lines.push(`- [ ] ${t.id}${tags ? ` ${tags}` : ""} ${t.title}`);
      if (t.detail) lines.push(`  - ${t.detail}`);
      if (t.dependsOn.length) lines.push(`  - After: ${t.dependsOn.join(", ")}`);
      for (const d of t.doneWhen.slice(0, 4)) lines.push(`  - Done when: ${d}`);
      for (const b of t.blockedBy.slice(0, 3)) lines.push(`  - ⚠ Ask first (${b.id}): ${b.question}`);
    }
    lines.push("");
  }

  if (plan.cycles.length) {
    lines.push(
      "## Dependency loop",
      "",
      `These components depend on each other in a cycle, so no build order satisfies every edge: ${plan.cycles.join(", ")}. Break the loop before building.`,
      ""
    );
  }
  return lines.join("\n").trimEnd() + "\n";
}
