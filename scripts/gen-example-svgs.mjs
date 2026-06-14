// gen-example-svgs.mjs — regenerate the README example scorecards from real engine code.
// Run: node scripts/gen-example-svgs.mjs
// Output: assets/example-claude-md.svg (significant) + assets/example-inconclusive.svg (tie)
//
// Both SVGs come straight out of scoreConfig() + compare() + renderSvg(), so the
// pictures in the README are produced by the same code that produces real reports —
// no hand-drawn mockups that can drift from reality.
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreConfig, compare } from "../src/engine/scorer.mjs";
import { renderSvg } from "../src/report/svg.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ASSETS = join(ROOT, "assets");

// Deterministic PRNG so the example art is byte-stable across machines / CI.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function synth(configId, { p, n, tokIn, tokOut, lat }, rnd) {
  const trials = [];
  for (let i = 0; i < n; i++) {
    trials.push({
      passed: rnd() < p,
      tokensIn: Math.round(tokIn * (0.9 + rnd() * 0.2)),
      tokensOut: Math.round(tokOut * (0.9 + rnd() * 0.2)),
      latencyMs: Math.round(lat * (0.85 + rnd() * 0.3)),
    });
  }
  return scoreConfig(configId, trials, { model: "claude-opus-4-8" });
}

const meta = { suite: "memory", model: "claude-opus-4-8", trialsPerConfig: 40 };

// 1) The real shipped fixture → the "significant" hero card.
const fixture = JSON.parse(await readFile(join(ROOT, "fixtures", "claude-md.json"), "utf8"));
const byConfig = new Map();
for (const r of fixture.records) {
  if (!byConfig.has(r.config)) byConfig.set(r.config, []);
  byConfig.get(r.config).push(r);
}
const heroScored = [...byConfig].map(([id, t]) => scoreConfig(id, t, { model: "claude-opus-4-8" }));
const heroResult = compare(heroScored);
await writeFile(
  join(ASSETS, "example-claude-md.svg"),
  renderSvg(heroResult, { suite: "claude-md", model: "claude-opus-4-8", trialsPerConfig: 90 }),
  "utf8"
);

// 2) A deliberately close race → the "inconclusive" card (the signature verdict).
const rnd = mulberry32(42);
const a = synth("distilled-memory", { p: 0.74, n: 40, tokIn: 5200, tokOut: 1700, lat: 8200 }, rnd);
const b = synth("raw-memory", { p: 0.66, n: 40, tokIn: 6100, tokOut: 1900, lat: 8600 }, rnd);
const tieResult = compare([a, b]);
await writeFile(join(ASSETS, "example-inconclusive.svg"), renderSvg(tieResult, meta), "utf8");

console.log("wrote assets/example-claude-md.svg (%s)", heroResult.verdict.kind);
console.log("wrote assets/example-inconclusive.svg (%s, p=%s)", tieResult.verdict.kind, tieResult.verdict.p.toFixed(3));
