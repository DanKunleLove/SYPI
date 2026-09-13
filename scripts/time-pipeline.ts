import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
import { PIPELINE_STEPS, type PipelineStepId } from "@/lib/ai/pipeline";
import { runStep, specSummary } from "@/lib/ai/pipeline-steps";
import { prisma } from "@/lib/prisma";
import { getSpec } from "@/lib/uss/store";
import { runScenarios } from "@/lib/uss/scenarios";
import type { RunRecord } from "@/lib/ai/run";

/**
 * Time every pipeline step against a real project.
 *
 * Vercel Hobby kills a function at 60 seconds. The whole reason the pipeline is
 * one step per request is to fit inside that, and the only responsible way to
 * know a step fits is to measure it. A step over ~40s needs splitting BEFORE the
 * UI is built on top of it, not after a user discovers it.
 *
 * This also answers the second question the redesign hangs on: what complexity
 * tier does the classifier actually give "a portfolio site"? The ladder has no
 * rung for "a public website with no state", and the answer decides whether the
 * budget alone fixes the over-engineering or whether the ladder needs work.
 *
 *   npx tsx scripts/time-pipeline.ts "a portfolio site for a developer"
 */

setDefaultResultOrder("ipv4first");

const BUDGET_MS = 40_000;
const CEILING_MS = 60_000;

async function main() {
  const brief = process.argv[2] ?? "a portfolio site for a developer";

  // A throwaway project, deleted at the end. This writes a real spec, and
  // dropping one onto someone's actual project would surface a wall of findings
  // about a canvas they did not ask us to analyse.
  const owner = await prisma.project.findFirst({ select: { userId: true } });
  if (!owner) {
    console.error("No user in this database to own a scratch project.");
    process.exit(1);
  }
  const project = await prisma.project.create({
    data: { name: `pipeline-timing-${Date.now()}`, userId: owner.userId },
    select: { id: true, name: true, userId: true },
  });

  console.log(`project: ${project.name} (${project.id})`);
  console.log(`brief:   "${brief}"\n`);

  // A fake run record — the steps only read brief/meta/id from it.
  const run: RunRecord = {
    id: `timing_${Date.now()}`,
    projectId: project.id,
    brief,
    kind: "pipeline",
    steps: {},
    meta: {},
  };

  const results: { step: string; ms: number; detail: string; ok: boolean }[] = [];

  for (const def of PIPELINE_STEPS) {
    if (def.id === "start") continue; // no model call; bookkeeping only

    const t0 = Date.now();
    try {
      const outcome = await runStep({
        step: def.id as Exclude<PipelineStepId, "start">,
        projectId: project.id,
        userId: project.userId,
        run,
        canvasNodes: [],
        canvasEdges: [],
      });
      const ms = Date.now() - t0;
      // Carry the draft architecture forward exactly as the route does.
      Object.assign(run.meta, outcome.meta ?? {});
      results.push({ step: def.id, ms, detail: outcome.detail ?? "", ok: true });

      const flag = ms > CEILING_MS ? "  OVER CEILING" : ms > BUDGET_MS ? "  tight" : "";
      console.log(
        `  ${String(Math.round(ms / 1000)).padStart(3)}s  ${def.id.padEnd(14)} ${outcome.detail ?? ""}${flag}`
      );
    } catch (e) {
      const ms = Date.now() - t0;
      const detail = e instanceof Error ? e.message : String(e);
      results.push({ step: def.id, ms, detail, ok: false });
      console.log(`  ${String(Math.round(ms / 1000)).padStart(3)}s  ${def.id.padEnd(14)} FAILED — ${detail}`);
      break;
    }
  }

  // ── What the run actually produced ─────────────────────────────────────────
  const record = await getSpec(project.id);
  console.log("\n" + "=".repeat(70));
  if (!record) {
    console.log("NO SPEC WAS WRITTEN — the reachability fix did not work.");
    process.exitCode = 1;
  } else {
    const s = specSummary(record.doc);
    const scenarios = runScenarios(record.doc);
    console.log(`spec version ${record.version}`);
    console.log(`  tier ${s.tier} (${s.tierLabel}) — budget ${record.doc.complexity.budget.maxComponents} components`);
    console.log(`  ${s.components} components, coverage ${s.coverage}%, ${s.materialDecisions} material decisions`);
    console.log(`  ${scenarios.filter((r) => r.outcome === "pass").length} scenarios proven, ${scenarios.filter((r) => r.outcome === "gap").length} gaps`);
    console.log(`  components: ${record.doc.entities.filter((e) => e.kind === "component").map((e) => e.title).join(", ")}`);
    if (s.components > record.doc.complexity.budget.maxComponents) {
      console.log(`  !! OVER BUDGET: ${s.components} > ${record.doc.complexity.budget.maxComponents}`);
    }
  }

  const worst = results.filter((r) => r.ok).sort((a, b) => b.ms - a.ms)[0];
  if (worst) {
    console.log(`\nslowest step: ${worst.step} at ${Math.round(worst.ms / 1000)}s (ceiling 60s)`);
    if (worst.ms > BUDGET_MS) {
      console.log("  Split it before building UI on top of it.");
    }
  }

  await prisma.project.delete({ where: { id: project.id } });
  console.log("scratch project deleted");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
