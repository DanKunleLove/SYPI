import "dotenv/config";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { generateObject, type LanguageModel } from "ai";
import { getModel } from "@/lib/ai/index";
import { PROVIDERS, isProviderId } from "@/lib/ai/providers";
import { GENERATION_SYSTEM_PROMPT, CRITIQUE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { ArchitectureOutputSchema, CritiqueOutputSchema, type ArchitectureOutput } from "@/lib/ai/schemas";
import { BRIEFS, getBrief } from "./briefs/index";
import { scoreArchitecture } from "./scorers";
import { judge } from "./judge";
import type { BriefResult, DimensionScore, EvalReport } from "./types";

/**
 * Evaluation runner.
 *
 * Calls the SAME functions the production /api/ai/generate route calls — the same
 * system prompt, the same schema, and the same self-critique-and-repair loop — but
 * in-process, so no HTTP, no auth, no quota and no deployment is involved. We are
 * measuring the quality of reasoning, not the transport.
 *
 *   npm run eval                       full run, writes evals/reports/<timestamp>.json
 *   npm run eval -- --baseline         also writes evals/baselines/<date>-baseline.json
 *   npm run eval -- --briefs=01,04     only those briefs (prefix match)
 *   npm run eval -- --no-judge         deterministic scorers only (no LLM judge calls)
 *   npm run eval -- --no-critique      skip the self-critique pass (raw generation)
 *   npm run eval -- --compare=<path>   diff against a previous report
 */

interface Args {
  baseline: boolean;
  briefs: string[] | null;
  judge: boolean;
  critique: boolean;
  runs: number;
  compare: string | null;
  /** Pause between provider calls. Free tiers rate-limit aggressively. */
  delayMs: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : null;
  };
  const briefs = get("briefs");
  return {
    baseline: argv.includes("--baseline"),
    briefs: briefs ? briefs.split(",").map((s) => s.trim()).filter(Boolean) : null,
    judge: !argv.includes("--no-judge"),
    critique: !argv.includes("--no-critique"),
    runs: Number(get("runs") ?? 1),
    compare: get("compare"),
    // Default 4s: the Gemini free tier rejected a back-to-back run after 20 calls.
    delayMs: Number(get("delay") ?? 4000),
  };
}

function modelId(model: LanguageModel): string {
  const m = model as unknown as { modelId?: string };
  return m.modelId ?? "unknown";
}

const KEY_ENV = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_AI_API_KEY",
} as const;

/**
 * Resolve the model to evaluate on.
 *
 * The platform Gemini free tier is rate-limited to a level that cannot sustain a
 * 10-brief run (verified the hard way: 20 requests before a 429). Set EVAL_PROVIDER
 * + the matching key env to run on your own key instead:
 *
 *   EVAL_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... npm run eval -- --baseline
 *   EVAL_PROVIDER=anthropic EVAL_MODEL=claude-sonnet-4-6 npm run eval
 *
 * Reuses the PROVIDERS registry in lib/ai/providers.ts so only whitelisted models
 * are accepted — the same constraint the product enforces for BYOK.
 */
function resolveEvalModel(tier: "flash" | "pro"): LanguageModel {
  const provider = process.env.EVAL_PROVIDER;
  if (!provider) return getModel(tier);

  if (!isProviderId(provider)) {
    throw new Error(
      `EVAL_PROVIDER must be one of: anthropic, openai, google (got "${provider}")`
    );
  }
  const key = process.env[KEY_ENV[provider]];
  if (!key) {
    throw new Error(`EVAL_PROVIDER=${provider} requires ${KEY_ENV[provider]} to be set`);
  }

  const def = PROVIDERS[provider];
  const requested = process.env.EVAL_MODEL;
  if (requested && !def.models.some((m) => m.id === requested)) {
    throw new Error(
      `EVAL_MODEL "${requested}" is not a known ${provider} model. Options: ${def.models.map((m) => m.id).join(", ")}`
    );
  }
  return def.create(key, requested ?? def.defaults[tier]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** True when an error is a provider rate-limit/quota rejection. */
function isQuotaError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return msg.includes("quota") || msg.includes("rate limit") || msg.includes("429");
}

function gitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/** Mirrors app/api/ai/generate/route.ts: generate, self-critique, repair criticals once. */
async function generateWithPipeline(
  model: LanguageModel,
  prompt: string,
  useCritique: boolean
): Promise<{ arch: ArchitectureOutput; repaired: boolean }> {
  const first = await generateObject({
    model,
    schema: ArchitectureOutputSchema,
    system: GENERATION_SYSTEM_PROMPT,
    prompt,
  });
  let arch = first.object;
  let repaired = false;

  if (!useCritique) return { arch, repaired };

  try {
    const summary =
      `NODES:\n${arch.nodes.map((n) => `- ${n.label} (${n.category})${n.description ? `: ${n.description}` : ""}`).join("\n")}\n\n` +
      `CONNECTIONS:\n${arch.edges.map((e) => `- ${e.sourceLabel} → ${e.targetLabel}${e.label ? ` [${e.label}]` : ""}`).join("\n")}`;

    const critique = await generateObject({
      model,
      schema: CritiqueOutputSchema,
      system: CRITIQUE_SYSTEM_PROMPT,
      prompt: `Review this freshly generated architecture for the request: "${prompt.slice(0, 500)}"\n\n${summary}`,
    });

    const critical = critique.object.issues.filter((i) => i.severity === "critical");
    if (critical.length > 0) {
      const issues = critical.map((i) => `- ${i.title}: ${i.description} FIX: ${i.suggestion}`).join("\n");
      const fixed = await generateObject({
        model,
        schema: ArchitectureOutputSchema,
        system: GENERATION_SYSTEM_PROMPT,
        prompt: `${prompt}\n\nYou already produced this draft:\n${summary}\n\nA design review found these CRITICAL issues:\n${issues}\n\nReturn the FULL corrected architecture (all nodes and edges, not a diff), fixing only these issues while keeping everything else intact.`,
      });
      arch = fixed.object;
      repaired = true;
    }
  } catch {
    // Self-critique is an enhancement, not a gate — same policy as production.
  }

  return { arch, repaired };
}

/** Median of the per-dimension scores across runs; unmeasurable stays unmeasurable. */
function medianScores(runs: DimensionScore[][]): DimensionScore[] {
  const byDimension = new Map<string, DimensionScore[]>();
  for (const run of runs) {
    for (const s of run) {
      const list = byDimension.get(s.dimension) ?? [];
      list.push(s);
      byDimension.set(s.dimension, list);
    }
  }
  const out: DimensionScore[] = [];
  for (const [dimension, list] of byDimension) {
    const first = list[0];
    if (!first.measurable) {
      out.push(first);
      continue;
    }
    const nums = list.map((s) => s.score!).sort((a, b) => a - b);
    const mid = Math.floor(nums.length / 2);
    const median = nums.length % 2 ? nums[mid] : Math.round((nums[mid - 1] + nums[mid]) / 2);
    out.push({
      ...first,
      score: median,
      detail: list.length > 1 ? `${first.detail} (median of ${list.length} runs)` : first.detail,
    });
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const model = resolveEvalModel("pro");
  const judgeModel = resolveEvalModel("flash");

  const selected = args.briefs
    ? BRIEFS.filter((b) => args.briefs!.some((p) => b.id.startsWith(p) || b.id.includes(p)))
    : BRIEFS;

  if (selected.length === 0) {
    console.error("No briefs matched. Available:", BRIEFS.map((b) => b.id).join(", "));
    process.exit(1);
  }

  console.log(`\nSYPI evaluation — ${selected.length} brief(s), ${args.runs} run(s) each`);
  console.log(`model: ${modelId(model)}   judge: ${args.judge ? modelId(judgeModel) : "off"}   self-critique: ${args.critique ? "on" : "off"}`);
  console.log("─".repeat(78));

  const results: BriefResult[] = [];
  let consecutiveQuotaFailures = 0;
  let aborted = false;

  for (const brief of selected) {
    if (aborted) break;
    process.stdout.write(`\n${brief.id}  ${brief.title}\n`);
    const perRun: DimensionScore[][] = [];
    let lastArch: ArchitectureOutput | undefined;
    let latency = 0;
    let failure: string | undefined;

    for (let run = 0; run < args.runs; run++) {
      try {
        if (results.length > 0 || run > 0) await sleep(args.delayMs);
        const t0 = Date.now();
        const { arch, repaired } = await generateWithPipeline(model, brief.brief, args.critique);
        latency = Date.now() - t0;
        lastArch = arch;

        const scores = scoreArchitecture(brief, arch);
        if (args.judge) {
          await sleep(args.delayMs);
          scores.push(...(await judge(judgeModel, brief, arch)));
        }
        perRun.push(scores);
        consecutiveQuotaFailures = 0;

        process.stdout.write(
          `  run ${run + 1}: ${arch.nodes.length} components, ${arch.edges.length} connections` +
            `${repaired ? ", self-repaired" : ""} (${(latency / 1000).toFixed(1)}s)\n`
        );
      } catch (e) {
        failure = e instanceof Error ? e.message : String(e);
        process.stdout.write(`  run ${run + 1}: FAILED — ${failure.slice(0, 200)}\n`);

        // Burning through ten briefs against an exhausted quota produces a
        // worthless report and wastes the remaining allowance. Stop early.
        if (isQuotaError(e)) {
          consecutiveQuotaFailures++;
          if (consecutiveQuotaFailures >= 2) {
            process.stdout.write(
              `\n  ABORTING — the provider is rejecting requests on quota.\n` +
                `  The platform Gemini free tier cannot sustain a full run. Use your own key:\n` +
                `    EVAL_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-... npm run eval -- --baseline\n`
            );
            aborted = true;
            break;
          }
        }
      }
    }

    if (perRun.length === 0) {
      results.push({ briefId: brief.id, title: brief.title, ok: false, error: failure, scores: [] });
      continue;
    }

    const scores = medianScores(perRun);
    for (const s of scores) {
      if (!s.measurable) continue;
      const bar = "█".repeat(Math.round(s.score! / 10)).padEnd(10, "·");
      process.stdout.write(`    ${bar} ${String(s.score).padStart(3)}  ${s.dimension}\n`);
      process.stdout.write(`               ${s.detail}\n`);
    }

    results.push({
      briefId: brief.id,
      title: brief.title,
      ok: true,
      latencyMs: latency,
      componentCount: lastArch?.nodes.length,
      edgeCount: lastArch?.edges.length,
      scores,
      raw: lastArch,
    });
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  const summary: EvalReport["summary"] = {};
  const dimensions = new Set<string>();
  for (const r of results) for (const s of r.scores) dimensions.add(s.dimension);

  for (const d of dimensions) {
    const all = results.flatMap((r) => r.scores.filter((s) => s.dimension === d));
    const measured = all.filter((s) => s.measurable && s.score !== null);
    summary[d] = {
      mean: measured.length ? Math.round(measured.reduce((a, s) => a + s.score!, 0) / measured.length) : null,
      measuredIn: measured.length,
      of: all.length,
    };
  }

  const report: EvalReport = {
    runAt: new Date().toISOString(),
    mode: "architecture",
    model: modelId(model),
    judgeModel: args.judge ? modelId(judgeModel) : null,
    runs: args.runs,
    gitCommit: gitCommit(),
    results,
    summary,
  };

  console.log("\n" + "═".repeat(78));
  console.log("SUMMARY (mean across briefs)\n");
  for (const [d, s] of Object.entries(summary).sort()) {
    if (s.mean === null) {
      console.log(`  ${"—".padStart(3)}  ${d.padEnd(28)} not measurable until the USS exists`);
    } else {
      const bar = "█".repeat(Math.round(s.mean / 10)).padEnd(10, "·");
      console.log(`  ${bar} ${String(s.mean).padStart(3)}  ${d}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) console.log(`\n  ${failed.length} brief(s) failed to generate.`);

  // ─── Compare against a previous report ─────────────────────────────────────
  if (args.compare) {
    const prev = JSON.parse(readFileSync(args.compare, "utf8")) as EvalReport;
    console.log("\n" + "═".repeat(78));
    console.log(`COMPARED TO ${args.compare}`);
    console.log(`  baseline: ${prev.model}, ${prev.runs} run(s), commit ${prev.gitCommit}`);
    console.log(`  current : ${report.model}, ${report.runs} run(s), commit ${report.gitCommit}`);
    if (prev.model !== report.model || prev.runs !== report.runs) {
      console.log("  ⚠ model or run-count differs — this is not a like-for-like comparison");
    }
    console.log("");

    let regressions = 0;
    for (const [d, cur] of Object.entries(summary).sort()) {
      const before = prev.summary[d];
      if (!before) {
        console.log(`  NEW      ${d.padEnd(28)} ${cur.mean ?? "—"}`);
        continue;
      }
      // A dimension that was unmeasurable and now has a score is a NEW measurement,
      // not an improvement. Saying "+72" here would be the exact self-flattery the
      // measurable flag exists to prevent.
      if (before.mean === null && cur.mean !== null) {
        console.log(`  NEW      ${d.padEnd(28)} ${cur.mean}  (first measurement — not a gain over 0)`);
        continue;
      }
      if (cur.mean === null || before.mean === null) continue;

      const delta = cur.mean - before.mean;
      const flag = delta < -5 ? "REGRESS " : delta > 5 ? "IMPROVE " : "        ";
      if (delta < -5) regressions++;
      const sign = delta > 0 ? "+" : "";
      console.log(`  ${flag} ${d.padEnd(28)} ${before.mean} → ${cur.mean}  (${sign}${delta})`);
    }

    console.log("");
    if (regressions > 0) {
      console.log(`  ${regressions} dimension(s) regressed by more than 5%. Gate: FAIL`);
      process.exitCode = 1;
    } else {
      console.log("  No dimension regressed by more than 5%. Gate: PASS");
    }
  }

  // ─── Write ─────────────────────────────────────────────────────────────────
  const stamp = report.runAt.replace(/[:.]/g, "-").slice(0, 19);
  mkdirSync(join(process.cwd(), "evals", "reports"), { recursive: true });
  const reportPath = join("evals", "reports", `${stamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nreport: ${reportPath}`);

  if (args.baseline) {
    // A baseline containing failures is worse than no baseline: every later
    // comparison would be measured against noise. Refuse to write one.
    const incomplete = failed.length > 0 || results.length < selected.length;
    if (incomplete) {
      console.log(
        `\n  BASELINE NOT WRITTEN — ${failed.length} failed, ${results.length}/${selected.length} briefs completed.` +
          `\n  A baseline must be a complete, clean run or it poisons every future comparison.`
      );
      process.exitCode = 1;
    } else {
      mkdirSync(join(process.cwd(), "evals", "baselines"), { recursive: true });
      const baselinePath = join("evals", "baselines", `${report.runAt.slice(0, 10)}-baseline.json`);
      writeFileSync(baselinePath, JSON.stringify(report, null, 2));
      console.log(`baseline: ${baselinePath}`);
    }
  }
}

main().catch((e) => {
  console.error("\nEval run failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
