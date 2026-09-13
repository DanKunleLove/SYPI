import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BRIEFS } from "./briefs/index";
import type { BriefResult, EvalReport } from "./types";

/**
 * The experiment: does the reasoning layer beat a strong raw prompt?
 *
 * Every brief is run TWICE — once with the USS chain (`uss`) and once without
 * (`control`, the `--no-uss` path, which is byte-for-byte the prompt that shipped
 * before any of this existed). Same model, same briefs, same judge, paired.
 *
 * Nothing in this repo has ever answered that question. Seven units were built on
 * the belief that specifying a system before designing it produces a better
 * design. It is a plausible belief. It is not a measured one, and the difference
 * between those two things is the difference between engineering and faith.
 *
 * ── Honest framing, stated before the run ────────────────────────────────────
 * This does NOT isolate "the USS graph". The uss arm changes the system prompt,
 * the injected context and the post-generation spec write all at once. What it
 * measures is SYPI AS SHIPPED versus a strong raw prompt — the question a client
 * actually cares about. The report must not claim the graph caused the delta.
 *
 * Note also that the control's system prompt says "typically 5-15 nodes" and "add
 * appropriate middleware where needed". A large simplicity win over that is partly
 * attributable to prompt text rather than to reasoning. Real, and it has to be
 * said out loud when the numbers are reported.
 *
 * ── Why one process per brief per arm ────────────────────────────────────────
 * Node's DNS resolver degrades after sustained connection use within a process:
 * the first brief completes, every one after it fails with getaddrinfo ENOTFOUND
 * while PowerShell resolves the same host in milliseconds. `sweep.ts` proved a
 * fresh process per brief fixes it. Same discipline here, and the same
 * resumability: 20 processes, each writing its result as it finishes.
 *
 *   npm run eval:ab                  all briefs, both arms
 *   npm run eval:ab -- --resume      skip arm-runs already on disk
 *   npm run eval:ab -- --briefs=01   one brief, both arms (a dry run)
 */

const OUT_DIR = join(process.cwd(), "evals", "reports", "ab");

type Arm = "control" | "uss";

/** Dimensions that only exist when a spec does. Reported, never averaged into the verdict. */
const USS_ONLY = [
  "traceability",
  "hallucination-rate",
  "spec-question-coverage",
  "unsupported-assumptions",
  "unresolved-decisions",
  "scenario-proof",
];

/** Declared BEFORE the run. Moving these after seeing the numbers is cheating. */
const THRESHOLDS = {
  minPairedBriefs: 8,
  businessCorrectnessMean: 8,
  implementabilityMean: 5,
  perBriefWin: 5,
  minWins: 6,
  maxLosses: 1,
  /** No guardrail dimension may fall by more than this. */
  maxGuardrailDrop: 3,
  guardrails: ["connectivity", "edge-labelling", "expected-properties"],
};

function armPath(briefId: string, arm: Arm): string {
  return join(OUT_DIR, `${briefId}.${arm}.json`);
}

function runOne(briefId: string, arm: Arm, passthrough: string[]): boolean {
  const args = [
    "tsx",
    "evals/run.ts",
    `--briefs=${briefId}`,
    ...(arm === "control" ? ["--no-uss"] : []),
    ...passthrough,
  ];
  console.log(`\n> ${briefId} [${arm}]`);

  const result = spawnSync("npx", args, { stdio: "inherit", shell: true, env: process.env });
  if (result.status !== 0) console.log(`  ${briefId} [${arm}]: process exited ${result.status}`);

  const reports = readdirSync(join(process.cwd(), "evals", "reports"))
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (reports.length === 0) return false;

  const latest = JSON.parse(
    readFileSync(join(process.cwd(), "evals", "reports", reports[reports.length - 1]), "utf8")
  ) as EvalReport;

  // Guard against picking up a stale report from an earlier run: the condition
  // recorded in the file must be the arm we just asked for.
  if (latest.ussEnabled !== (arm === "uss")) {
    console.log(`  ${briefId} [${arm}]: newest report is the wrong condition; discarding`);
    return false;
  }

  const briefResult = latest.results.find((r) => r.briefId === briefId);
  if (!briefResult?.ok) return false;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    armPath(briefId, arm),
    JSON.stringify(
      {
        meta: {
          model: latest.model,
          judgeModel: latest.judgeModel,
          runs: latest.runs,
          gitCommit: latest.gitCommit,
        },
        arm,
        result: briefResult,
      },
      null,
      2
    )
  );
  return true;
}

function scoreOf(result: BriefResult | null, dimension: string): number | null {
  if (!result) return null;
  const s = result.scores.find((x) => x.dimension === dimension);
  return s && s.measurable && s.score !== null ? s.score : null;
}

function main() {
  const argv = process.argv.slice(2);
  const resume = argv.includes("--resume");
  const passthrough = argv.filter(
    (a) => a !== "--resume" && !a.startsWith("--compare") && !a.startsWith("--baseline")
  );
  const only = argv.find((a) => a.startsWith("--briefs="))?.slice("--briefs=".length);
  const briefs = only
    ? BRIEFS.filter((b) => only.split(",").some((f) => b.id.startsWith(f.trim())))
    : BRIEFS;

  mkdirSync(OUT_DIR, { recursive: true });

  const failures: string[] = [];

  briefs.forEach((brief, index) => {
    // Alternate which arm goes first. Provider-side drift over a three-hour run
    // would otherwise favour whichever arm always ran second, and that is an
    // objection worth removing for free.
    const order: Arm[] = index % 2 === 0 ? ["control", "uss"] : ["uss", "control"];
    for (const arm of order) {
      if (resume && existsSync(armPath(brief.id, arm))) {
        console.log(`\n> ${brief.id} [${arm}] - already on disk, skipping`);
        continue;
      }
      if (!runOne(brief.id, arm, passthrough)) failures.push(`${brief.id}:${arm}`);
    }
  });

  // --- Pair up -------------------------------------------------------------
  interface Pair {
    briefId: string;
    title: string;
    control: BriefResult | null;
    uss: BriefResult | null;
    paired: boolean;
    deltas: Record<string, number | null>;
  }

  const load = (briefId: string, arm: Arm): BriefResult | null => {
    if (!existsSync(armPath(briefId, arm))) return null;
    return JSON.parse(readFileSync(armPath(briefId, arm), "utf8")).result as BriefResult;
  };

  const dimensions = new Set<string>();
  const pairs: Pair[] = briefs.map((b) => {
    const control = load(b.id, "control");
    const uss = load(b.id, "uss");
    for (const r of [control, uss]) for (const s of r?.scores ?? []) dimensions.add(s.dimension);

    const deltas: Record<string, number | null> = {};
    for (const d of dimensions) {
      const c = scoreOf(control, d);
      const u = scoreOf(uss, d);
      deltas[d] = c === null || u === null ? null : u - c;
    }
    return { briefId: b.id, title: b.title, control, uss, paired: Boolean(control && uss), deltas };
  });

  const paired = pairs.filter((p) => p.paired);

  // Means over PAIRED briefs only. A brief where one arm failed is excluded from
  // every number rather than quietly averaged on one side.
  const summary: Record<string, { control: number | null; uss: number | null; delta: number | null; n: number }> = {};
  for (const d of [...dimensions].sort()) {
    const both = paired
      .map((p) => ({ c: scoreOf(p.control, d), u: scoreOf(p.uss, d) }))
      .filter((x) => x.c !== null && x.u !== null) as { c: number; u: number }[];
    const mean = (xs: number[]) =>
      xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
    const c = mean(both.map((x) => x.c));
    const u = mean(both.map((x) => x.u));
    summary[d] = { control: c, uss: u, delta: c === null || u === null ? null : u - c, n: both.length };
  }

  // --- Verdict -------------------------------------------------------------
  const wins: string[] = [];
  const losses: string[] = [];
  const ties: string[] = [];
  for (const p of paired) {
    const d = p.deltas["business-correctness"];
    if (d === null || d === undefined) ties.push(p.briefId);
    else if (d > THRESHOLDS.perBriefWin) wins.push(p.briefId);
    else if (d < -THRESHOLDS.perBriefWin) losses.push(p.briefId);
    else ties.push(p.briefId);
  }

  const guardrailBreaches = THRESHOLDS.guardrails.filter(
    (g) => (summary[g]?.delta ?? 0) < -THRESHOLDS.maxGuardrailDrop
  );

  const passed =
    paired.length >= THRESHOLDS.minPairedBriefs &&
    (summary["business-correctness"]?.delta ?? -99) >= THRESHOLDS.businessCorrectnessMean &&
    (summary["implementability"]?.delta ?? -99) >= THRESHOLDS.implementabilityMean &&
    wins.length >= THRESHOLDS.minWins &&
    losses.length <= THRESHOLDS.maxLosses &&
    guardrailBreaches.length === 0;

  // --- Report --------------------------------------------------------------
  console.log("\n" + "=".repeat(78));
  console.log(`A/B COMPLETE - ${paired.length}/${briefs.length} briefs paired`);
  if (failures.length) console.log(`failed arm-runs: ${failures.join(", ")}  (re-run with --resume)`);
  const excluded = pairs.filter((p) => !p.paired);
  if (excluded.length) {
    console.log(`excluded from every mean (one arm missing): ${excluded.map((p) => p.briefId).join(", ")}`);
  }

  console.log("\nPAIRED MEANS  (control -> uss)\n");
  for (const [d, s] of Object.entries(summary)) {
    if (USS_ONLY.includes(d)) continue;
    if (s.control === null || s.uss === null) continue;
    const sign = s.delta! > 0 ? "+" : "";
    const flag = s.delta! >= 5 ? " <<" : s.delta! <= -5 ? " !!" : "";
    console.log(
      `  ${d.padEnd(28)} ${String(s.control).padStart(3)} -> ${String(s.uss).padStart(3)}  (${sign}${s.delta})  n=${s.n}${flag}`
    );
  }

  // Never averaged into the verdict: these are null in the control arm, so a
  // "SYPI is better" number built from them would be measuring nothing but its
  // own existence.
  console.log("\nUSS-ONLY MEASUREMENTS  (no control value exists; NOT part of the verdict)\n");
  for (const d of USS_ONLY) {
    const s = summary[d];
    if (!s || s.uss === null) continue;
    console.log(`  ${d.padEnd(28)} ${s.uss}`);
  }

  console.log("\nPER BRIEF  (business-correctness)\n");
  for (const p of pairs) {
    if (!p.paired) {
      console.log(`  ${p.briefId.padEnd(26)} EXCLUDED - ${p.control ? "uss" : "control"} arm failed`);
      continue;
    }
    const d = p.deltas["business-correctness"];
    const label = d === null ? "  ?  " : d > THRESHOLDS.perBriefWin ? " WIN " : d < -THRESHOLDS.perBriefWin ? " LOSS" : " tie ";
    console.log(
      `  ${p.briefId.padEnd(26)} ${String(scoreOf(p.control, "business-correctness") ?? "-").padStart(3)} -> ${String(scoreOf(p.uss, "business-correctness") ?? "-").padStart(3)}  ${label}`
    );
  }

  console.log("\n" + "=".repeat(78));
  console.log(`VERDICT: ${passed ? "SYPI WINS" : "NOT PROVEN"}`);
  console.log(`  ${wins.length} wins, ${losses.length} losses, ${ties.length} ties over ${paired.length} paired briefs`);
  if (guardrailBreaches.length) console.log(`  guardrail breach: ${guardrailBreaches.join(", ")}`);

  // The simplicity check is diagnostic, not part of the verdict, but it decides
  // whether the rest of the result can be interpreted at all: if the budget did
  // not bind, the spec never reached the design and nothing else here means much.
  const simplicity = summary["simplicity"]?.delta;
  if (simplicity !== null && simplicity !== undefined && simplicity < 5) {
    console.log(
      `\n  WARNING: simplicity moved only ${simplicity}. The budget did not bind,` +
        `\n  so the spec is probably still not driving the design. Treat this as a` +
        `\n  failed experiment rather than a null result.`
    );
  }

  console.log(
    `\n  n=${paired.length}, ${paired[0] ? JSON.parse(readFileSync(armPath(paired[0].briefId, "uss"), "utf8")).meta.runs : "?"} run(s) per arm.` +
      `\n  A single-digit mean delta at this n is suggestive, not significant.` +
      `\n  The control's own prompt says "typically 5-15 nodes" and "add appropriate` +
      `\n  middleware", so part of any simplicity win is prompt text, not reasoning.`
  );

  const meta = paired[0]
    ? JSON.parse(readFileSync(armPath(paired[0].briefId, "uss"), "utf8")).meta
    : { model: "unknown", judgeModel: null, runs: 1, gitCommit: "unknown" };

  const out = {
    runAt: new Date().toISOString(),
    ...meta,
    pairs,
    summary,
    ussOnly: Object.fromEntries(USS_ONLY.map((d) => [d, summary[d]?.uss ?? null])),
    thresholds: THRESHOLDS,
    verdict: { pairedBriefs: paired.length, wins, losses, ties, guardrailBreaches, passed },
  };
  const path = join(process.cwd(), "evals", "reports", `ab-${out.runAt.slice(0, 10)}.json`);
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`\nreport: ${path}`);

  if (failures.length > 0) process.exitCode = 1;
}

main();
