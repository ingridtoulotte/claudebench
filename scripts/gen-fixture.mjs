// gen-fixture.mjs — produce a deterministic demo fixture.
//
// This is a DEV tool, not part of the runtime. It samples plausible trial
// outcomes from fixed "true" pass probabilities so `claudebench demo` always
// shows the same scorecard with no API calls. Re-run to regenerate:
//
//   node scripts/gen-fixture.mjs
//
// Real fixtures are produced by `claudebench run --live --save`; this seeded
// generator only exists so the repo demos out-of-the-box and CI stays free.
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Deterministic PRNG (mulberry32) so the fixture is byte-stable across machines.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260613);
function gauss(mean, sd) {
  // Box–Muller
  const u = 1 - rand();
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Fixed ground truth for the demo. terse config genuinely does better here.
const TRUTH = {
  "verbose-rules": {
    tasks: {
      "fix-off-by-one": { p: 0.75, tin: 9200, tout: 1500, lat: 8600 },
      "implement-parse-range": { p: 0.65, tin: 11800, tout: 2400, lat: 10200 },
      "refactor-dedupe": { p: 0.62, tin: 10400, tout: 2100, lat: 9100 },
    },
  },
  "terse-rules": {
    tasks: {
      "fix-off-by-one": { p: 0.9, tin: 5400, tout: 1300, lat: 7200 },
      "implement-parse-range": { p: 0.85, tin: 7100, tout: 2000, lat: 8900 },
      "refactor-dedupe": { p: 0.8, tin: 6200, tout: 1700, lat: 8000 },
    },
  },
};

const TRIALS = 30;
const records = [];
for (const [config, cfg] of Object.entries(TRUTH)) {
  for (const [task, t] of Object.entries(cfg.tasks)) {
    for (let k = 0; k < TRIALS; k++) {
      records.push({
        config,
        task,
        trial: k,
        passed: rand() < t.p,
        tokensIn: Math.max(0, Math.round(gauss(t.tin, t.tin * 0.12))),
        tokensOut: Math.max(0, Math.round(gauss(t.tout, t.tout * 0.18))),
        latencyMs: Math.max(0, Math.round(gauss(t.lat, t.lat * 0.15))),
      });
    }
  }
}

const fixture = {
  note: "Seeded demo fixture (gen-fixture.mjs). NOT real model runs — for demo/CI only.",
  suite: "claude-md",
  model: "claude-opus-4-8",
  generator: { seed: 20260613, trials: TRIALS },
  records,
};

const out = resolve(__dirname, "../fixtures/claude-md.json");
await writeFile(out, JSON.stringify(fixture, null, 2) + "\n", "utf8");
console.log(`wrote ${records.length} records → ${out}`);
