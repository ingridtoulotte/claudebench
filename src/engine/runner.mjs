// runner.mjs — orchestrates a benchmark run and produces a reproducible artifact.
//
// Two execution modes share one output format (the run artifact), which is the
// key to reproducibility:
//
//   live    actually run the agent on every (config × task × trial) and record
//           the raw transcript + usage into the artifact.
//   replay  reconstruct the exact same trial records from a saved artifact /
//           fixture, so scoring is bit-for-bit reproducible with zero cost and
//           no API key. The demo, the tests and CI all use replay.
import { mkdtemp, mkdir, writeFile, cp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runClaudeCode } from "../adapters/claude-code.mjs";
import { gradeTask } from "./grader.mjs";
import { shortHash, hashJson } from "../util/hash.mjs";

/**
 * @param {object} suite  loaded suite: { id, configs:[{id,content,files?}], tasks:[{id,prompt,test,files?}] }
 * @param {object} opts   { mode:'live'|'replay', trials, model, fixture, onProgress }
 * @returns {Promise<object>} run artifact
 */
export async function runSuite(suite, opts = {}) {
  const mode = opts.mode || "replay";
  const trials = opts.trials ?? 20;
  const model = opts.model || "claude-opus-4-8";
  const runId = `run-${shortHash({ suite: suite.id, t: Date.now(), n: trials })}`;
  const suiteHash = shortHash({
    configs: suite.configs.map((c) => ({ id: c.id, content: c.content })),
    tasks: suite.tasks.map((t) => ({ id: t.id, prompt: t.prompt, test: t.test })),
  });

  let records;
  if (mode === "replay") {
    records = await replay(suite, opts.fixture);
  } else {
    records = await live(suite, { trials, model, onProgress: opts.onProgress });
  }

  return {
    runId,
    suite: suite.id,
    suiteHash,
    model,
    mode,
    createdAt: new Date().toISOString(),
    trialsPerConfig: countTrialsPerConfig(records),
    records, // every (config,task,trial) outcome — the audit trail
    recordsHash: hashJson(records.map((r) => ({ c: r.config, t: r.task, k: r.trial, p: r.passed }))),
  };
}

function countTrialsPerConfig(records) {
  const byConfig = new Map();
  for (const r of records) byConfig.set(r.config, (byConfig.get(r.config) || 0) + 1);
  return Math.max(...byConfig.values(), 0);
}

// ── replay ────────────────────────────────────────────────────────────────
async function replay(suite, fixture) {
  if (!fixture) throw new Error("replay mode needs a fixture/artifact");
  const data = typeof fixture === "string" ? JSON.parse(await readFile(fixture, "utf8")) : fixture;
  const records = data.records || data;
  // Validate the fixture matches the suite so a stale replay can't silently lie.
  const configIds = new Set(suite.configs.map((c) => c.id));
  for (const r of records) {
    if (!configIds.has(r.config)) {
      throw new Error(`fixture references unknown config "${r.config}" — suite/fixture mismatch`);
    }
  }
  return records;
}

// ── live ────────────────────────────────────────────────────────────────
async function live(suite, { trials, model, onProgress }) {
  const records = [];
  const total = suite.configs.length * suite.tasks.length * trials;
  let done = 0;
  for (const config of suite.configs) {
    for (const task of suite.tasks) {
      for (let k = 0; k < trials; k++) {
        const ws = await prepareWorkspace(suite, config, task);
        try {
          const run = await runClaudeCode(task, { cwd: ws, model });
          const grade = await gradeTask(task, { cwd: ws });
          records.push({
            config: config.id,
            task: task.id,
            trial: k,
            passed: grade.passed,
            tokensIn: run.tokensIn,
            tokensOut: run.tokensOut,
            latencyMs: run.latencyMs,
          });
        } finally {
          await rm(ws, { recursive: true, force: true });
          onProgress?.(++done, total);
        }
      }
    }
  }
  return records;
}

async function prepareWorkspace(suite, config, task) {
  const ws = await mkdtemp(join(tmpdir(), "cbench-"));
  // The config under test IS the CLAUDE.md (or whatever file the config names).
  await writeFile(join(ws, config.target || "CLAUDE.md"), config.content || "", "utf8");
  if (task.fixtureDir) {
    await cp(task.fixtureDir, ws, { recursive: true });
  }
  if (task.files) {
    for (const [rel, content] of Object.entries(task.files)) {
      const dest = join(ws, rel);
      await mkdir(join(dest, ".."), { recursive: true });
      await writeFile(dest, content, "utf8");
    }
  }
  return ws;
}
