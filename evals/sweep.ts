import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BRIEFS } from "./briefs/index";
import type { BriefResult, EvalReport } from "./types";

/**
 * Run the benchmark one brief per PROCESS, then merge.
 *
 * Measured behaviour on this machine: the first brief completes, and every brief
 * after it fails with getaddrinfo ENOTFOUND — while PowerShell resolves the same
 * host in milliseconds and the API answers in 1.4s. Node's resolver degrades after
 * sustained connection use within a single process, so no amount of retrying
 * inside that process helps. A fresh process per brief starts from a clean
 * resolver state.
 *
 * It also makes the run RESUMABLE. Each brief's report is written as it completes,
 * so a failure at brief 7 no longer discards the six that worked — which is what
 * made every previous attempt cost hours and produce nothing.
 *
 *   npm run eval:sweep                 all briefs, one process each
 *   npm run eval:sweep -- --resume     skip briefs already on disk
 *   npm run eval:sweep -- --baseline   write a baseline when ALL briefs succeed
 */

const OUT_DIR = join(process.cwd(), "evals", "reports", "sweep");

function briefPath(id: string): string {
  return join(OUT_DIR, `${id}.json`);
}

function runOne(briefId: string, passthrough: string[]): boolean {
  const args = ["tsx", "evals/run.ts", `--briefs=${briefId}`, ...passthrough];
  console.log(`\n▶ ${briefId}`);

  const result = spawnSync("npx", args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    console.log(`  ${briefId}: process exited ${result.status}`);
  }

  // The runner writes a timestamped report; take the newest and keep the result
  // for this brief only if it actually succeeded.
  const reports = readdirSync(join(process.cwd(), "evals", "reports"))
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (reports.length === 0) return false;

  const latest = JSON.parse(
    readFileSync(join(process.cwd(), "evals", "reports", reports[reports.length - 1]), "utf8")
  ) as EvalReport;

  const briefResult = latest.results.find((r) => r.briefId === briefId);
  if (!briefResult?.ok) return false;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    briefPath(briefId),
    JSON.stringify({ meta: { model: latest.model, judgeModel: latest.judgeModel, runs: latest.runs, gitCommit: latest.gitCommit }, result: briefResult }, null, 2)
  );
  return true;
}

function main() {
  const argv = process.argv.slice(2);
  const resume = argv.includes("--resume");
  const wantBaseline = argv.includes("--baseline");
  // Everything else is handed to the per-brief runner unchanged.
  const passthrough = argv.filter(
    (a) => a !== "--resume" && a !== "--baseline" && !a.startsWith("--compare")
  );

  mkdirSync(OUT_DIR, { recursive: true });

  const done: string[] = [];
  const failed: string[] = [];

  for (const brief of BRIEFS) {
    if (resume && existsSync(briefPath(brief.id))) {
      console.log(`\n▶ ${brief.id} — already on disk, skipping`);
      done.push(brief.id);
      continue;
    }
    (runOne(brief.id, passthrough) ? done : failed).push(brief.id);
  }

  // ─── Merge ─────────────────────────────────────────────────────────────────
  const results: BriefResult[] = [];
  let meta: { model: string; judgeModel: string | null; runs: number; gitCommit: string } | null =
    null;

  for (const brief of BRIEFS) {
    if (!existsSync(briefPath(brief.id))) continue;
    const saved = JSON.parse(readFileSync(briefPath(brief.id), "utf8"));
    meta ??= saved.meta;
    results.push(saved.result as BriefResult);
  }

  const summary: EvalReport["summary"] = {};
  const dimensions = new Set<string>();
  for (const r of results) for (const s of r.scores) dimensions.add(s.dimension);
  for (const d of dimensions) {
    const all = results.flatMap((r) => r.scores.filter((s) => s.dimension === d));
    const measured = all.filter((s) => s.measurable && s.score !== null);
    summary[d] = {
      mean: measured.length
        ? Math.round(measured.reduce((a, s) => a + s.score!, 0) / measured.length)
        : null,
      measuredIn: measured.length,
      of: all.length,
    };
  }

  const report: EvalReport = {
    runAt: new Date().toISOString(),
    mode: "architecture",
    model: meta?.model ?? "unknown",
    judgeModel: meta?.judgeModel ?? null,
    runs: meta?.runs ?? 1,
    gitCommit: meta?.gitCommit ?? "unknown",
    results,
    summary,
  };

  console.log("\n" + "═".repeat(78));
  console.log(`SWEEP COMPLETE — ${done.length}/${BRIEFS.length} briefs succeeded`);
  if (failed.length) console.log(`failed: ${failed.join(", ")}  (re-run with --resume)`);
  console.log("");

  for (const [d, s] of Object.entries(summary).sort()) {
    if (s.mean === null) continue;
    const bar = "█".repeat(Math.round(s.mean / 10)).padEnd(10, "·");
    console.log(`  ${bar} ${String(s.mean).padStart(3)}  ${d}  (n=${s.measuredIn})`);
  }

  const merged = join(process.cwd(), "evals", "reports", `sweep-${report.runAt.slice(0, 10)}.json`);
  writeFileSync(merged, JSON.stringify(report, null, 2));
  console.log(`\nmerged report: ${merged}`);

  if (wantBaseline) {
    if (failed.length > 0 || results.length < BRIEFS.length) {
      console.log(
        `\n  BASELINE NOT WRITTEN — ${results.length}/${BRIEFS.length} briefs.` +
          `\n  A baseline must be complete, or it poisons every future comparison.`
      );
      process.exitCode = 1;
    } else {
      const path = join(process.cwd(), "evals", "baselines", `${report.runAt.slice(0, 10)}-baseline.json`);
      mkdirSync(join(process.cwd(), "evals", "baselines"), { recursive: true });
      writeFileSync(path, JSON.stringify(report, null, 2));
      console.log(`baseline: ${path}`);
    }
  }
}

main();
