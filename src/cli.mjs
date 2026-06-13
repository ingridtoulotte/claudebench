// cli.mjs — ClaudeBench command-line surface.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSuite, resolveSuitePath } from "./engine/suite.mjs";
import { runSuite } from "./engine/runner.mjs";
import { scoreConfig, compare } from "./engine/scorer.mjs";
import { renderScorecard, renderSingleCard } from "./report/scorecard.mjs";
import { renderSvg } from "./report/svg.mjs";
import { c } from "./util/colors.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const SUITES_DIR = join(PKG_ROOT, "suites");
const FIXTURES_DIR = join(PKG_ROOT, "fixtures");
const RUNS_DIR = join(process.cwd(), ".claudebench", "runs");

const VERSION = "0.1.0";

export async function main(argv) {
  const { cmd, positional, flags } = parseArgs(argv);
  switch (cmd) {
    case "demo":
      return cmdCompare("claude-md", { ...flags, fixture: flags.fixture });
    case "compare":
      return cmdCompare(positional[0] || "claude-md", flags);
    case "run":
      return cmdRun(positional[0] || "claude-md", flags);
    case "replay":
      return cmdReplay(positional[0], flags);
    case "list":
      return cmdList();
    case "report":
      return cmdReport(positional[0], flags);
    case "version":
    case "--version":
      return console.log(`claudebench ${VERSION}`);
    case "help":
    case undefined:
    default:
      return printHelp();
  }
}

// ── helpers ────────────────────────────────────────────────────────────────
function scoreRun(artifact) {
  const byConfig = new Map();
  for (const r of artifact.records) {
    if (!byConfig.has(r.config)) byConfig.set(r.config, []);
    byConfig.get(r.config).push(r);
  }
  const scored = [...byConfig].map(([id, trials]) =>
    scoreConfig(id, trials, { model: artifact.model })
  );
  return { scored, result: compare(scored) };
}

async function saveArtifact(artifact) {
  await mkdir(RUNS_DIR, { recursive: true });
  const file = join(RUNS_DIR, `${artifact.runId}.json`);
  await writeFile(file, JSON.stringify(artifact, null, 2) + "\n", "utf8");
  return file;
}

function defaultFixtureFor(suiteId) {
  const f = join(FIXTURES_DIR, `${suiteId}.json`);
  return existsSync(f) ? f : null;
}

// ── commands ─────────────────────────────────────────────────────────────
async function cmdCompare(suiteName, flags) {
  const suite = await loadSuite(resolveSuitePath(suiteName, SUITES_DIR));
  const mode = flags.live ? "live" : "replay";
  const fixture = mode === "replay" ? flags.fixture || defaultFixtureFor(suite.id) : undefined;

  if (mode === "replay" && !fixture) {
    fail(
      `no fixture for suite "${suite.id}".\n` +
        `  run it live:   ${c.cyan(`claudebench compare ${suiteName} --live`)}\n` +
        `  or pass one:   ${c.cyan(`claudebench compare ${suiteName} --fixture <file.json>`)}`
    );
  }

  if (mode === "live") {
    process.stderr.write(c.gray("running live (this calls Claude Code for real)…\n"));
  }
  const artifact = await runSuite(suite, {
    mode,
    fixture,
    trials: Number(flags.trials) || 20,
    model: suite.model || flags.model,
    onProgress: liveProgress,
  });
  const file = await saveArtifact(artifact);
  const { result } = scoreRun(artifact);

  if (flags.json) {
    console.log(JSON.stringify({ artifact: file, result }, null, 2));
    return;
  }
  const meta = {
    suite: artifact.suite,
    model: artifact.model,
    trialsPerConfig: artifact.trialsPerConfig,
    suiteHash: artifact.suiteHash,
    runId: artifact.runId,
  };
  console.log(renderScorecard(result, meta));
}

async function cmdRun(suiteName, flags) {
  const suite = await loadSuite(resolveSuitePath(suiteName, SUITES_DIR));
  const fixture = flags.fixture || defaultFixtureFor(suite.id);
  const artifact = await runSuite(suite, {
    mode: flags.live ? "live" : "replay",
    fixture,
    trials: Number(flags.trials) || 20,
    model: suite.model || flags.model,
    onProgress: liveProgress,
  });
  const { scored } = scoreRun(artifact);
  const only = flags.config ? scored.filter((s) => s.configId === flags.config) : scored;
  for (const s of only) {
    console.log("\n" + renderSingleCard(s, { suite: artifact.suite }));
  }
}

async function cmdReplay(runRef, flags) {
  if (!runRef) fail("usage: claudebench replay <runId|artifact.json>");
  const path = runRef.endsWith(".json") ? resolve(runRef) : join(RUNS_DIR, `${runRef}.json`);
  if (!existsSync(path)) fail(`artifact not found: ${path}`);
  const artifact = JSON.parse(await readFile(path, "utf8"));
  const { result } = scoreRun(artifact);
  if (flags.json) return console.log(JSON.stringify(result, null, 2));
  console.log(
    renderScorecard(result, {
      suite: artifact.suite,
      model: artifact.model,
      trialsPerConfig: artifact.trialsPerConfig,
      suiteHash: artifact.suiteHash,
      runId: artifact.runId,
    })
  );
  console.log(c.gray(`  (re-scored from ${path} — recordsHash ${artifact.recordsHash.slice(0, 12)})`));
}

async function cmdReport(runRef, flags) {
  if (!runRef) fail("usage: claudebench report <runId|artifact.json> [--svg out.svg]");
  const path = runRef.endsWith(".json") ? resolve(runRef) : join(RUNS_DIR, `${runRef}.json`);
  if (!existsSync(path)) fail(`artifact not found: ${path}`);
  const artifact = JSON.parse(await readFile(path, "utf8"));
  const { result } = scoreRun(artifact);
  const svg = renderSvg(result, {
    suite: artifact.suite,
    model: artifact.model,
    trialsPerConfig: artifact.trialsPerConfig,
  });
  const out = flags.svg || `${artifact.runId}.svg`;
  await writeFile(out, svg, "utf8");
  console.log(c.green(`wrote ${out}`));
}

async function cmdList() {
  const entries = await readdir(SUITES_DIR, { withFileTypes: true });
  console.log(c.bold("\n  Built-in suites\n"));
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const sp = join(SUITES_DIR, e.name, "suite.json");
    if (!existsSync(sp)) continue;
    const s = JSON.parse(await readFile(sp, "utf8"));
    const hasFixture = defaultFixtureFor(s.id) ? c.green(" ● demo-ready") : c.gray(" ○ live-only");
    console.log(`  ${c.cyan(s.id.padEnd(16))} ${s.title}${hasFixture}`);
  }
  console.log();
}

// ── plumbing ───────────────────────────────────────────────────────────────
let lastPct = -1;
function liveProgress(done, total) {
  const p = Math.floor((done / total) * 100);
  if (p !== lastPct) {
    lastPct = p;
    process.stderr.write(`\r  ${p}%  (${done}/${total} trials)   `);
    if (done === total) process.stderr.write("\n");
  }
}

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const positional = [];
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else { flags[key] = next; i++; }
    } else positional.push(a);
  }
  return { cmd, positional, flags };
}

function fail(msg) {
  console.error(c.red("error: ") + msg);
  process.exit(1);
}

function printHelp() {
  console.log(`
${c.bold(c.cyan("⬡ ClaudeBench"))} ${c.gray(VERSION)} — stop arguing about prompts. measure them.

${c.bold("USAGE")}
  claudebench <command> [suite] [flags]

${c.bold("COMMANDS")}
  ${c.cyan("demo")}                 run the bundled CLAUDE.md comparison (no API key needed)
  ${c.cyan("compare")} <suite>      score every config in a suite and pick a winner
  ${c.cyan("run")} <suite>          score configs individually (per-config cards)
  ${c.cyan("replay")} <run>         re-score a saved run artifact (bit-exact, free)
  ${c.cyan("report")} <run>         render a run as a shareable SVG
  ${c.cyan("list")}                 list built-in suites
  ${c.cyan("help")}                 show this

${c.bold("FLAGS")}
  --live               run the real Claude Code CLI instead of a fixture
  --trials <n>         trials per task (default 20)
  --fixture <file>     replay from a specific artifact/fixture
  --config <id>        (run) limit to one config
  --svg <file>         (report) output path
  --json               machine-readable output

${c.bold("EXAMPLES")}
  npx claudebench demo
  claudebench compare claude-md --live --trials 30
  claudebench replay run-ab12cd34ef56
`);
}
