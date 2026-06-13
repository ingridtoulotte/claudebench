# ClaudeBench Architecture

Zero runtime dependencies, pure Node ESM, no build step. The design goal is that a skeptic can read
the whole thing in an afternoon.

## Module map

```
bin/claudebench.mjs        thin entrypoint → src/cli.mjs
src/
  cli.mjs                  arg parsing + command dispatch (demo/compare/run/replay/report/list)
  index.mjs                public library API (import { runSuite, compare } from "claudebench")
  engine/
    suite.mjs              load + resolve suite.json (inline config contents, resolve task dirs)
    runner.mjs             orchestrate live | replay → produce a run artifact
    grader.mjs             run a task's test.cmd, pass = exit 0  (NO llm judge)
    scorer.mjs             trials → pass rate + CI + token/latency/cost stats + verdict
    stats.mjs              wilson(), twoProportionTest(), mean/stddev/percentile  (the trust core)
  adapters/
    claude-code.mjs        spawn `claude -p --output-format json`; parse usage  (only model contact)
  report/
    scorecard.mjs          the terminal scorecard (the screenshot)
    table.mjs              ANSI-aware box/bar/sparkline/columns primitives
    svg.mjs                self-contained SVG export for READMEs
  util/
    colors.mjs             hand-rolled ANSI, respects NO_COLOR / non-TTY
    hash.mjs               stable-stringify + sha256 for reproducibility receipts
suites/<id>/               built-in benchmark suites (suite.json + configs/ + tasks/)
fixtures/<id>.json         recorded trials so demos run free + offline + deterministic
scripts/gen-fixture.mjs    dev-only seeded fixture generator (not shipped at runtime)
test/                      unit tests for stats + scoring
```

## Data flow

```
loadSuite(suite.json)
      │   { configs:[{id,content}], tasks:[{id,prompt,test,fixtureDir}] }
      ▼
runSuite(suite, {mode})
      ├─ live:   for config×task×trial → prepareWorkspace → runClaudeCode → gradeTask → record
      └─ replay: load fixture/artifact → validate against suite → records
      ▼
  run artifact  { runId, suiteHash, model, records[], recordsHash }   ── saved to .claudebench/runs/
      ▼
scoreRun(artifact)  → scoreConfig() per config → compare()
      ▼
renderScorecard() | renderSvg() | JSON
```

## The one extension point that matters: adapters

Everything that touches a model lives in `src/adapters/`. Today there's one adapter
(`claude-code.mjs`, the headless CLI). Supporting the Claude API directly, or a different agent, is
a single new file exposing:

```js
async function run(task, opts) → { text, tokensIn, tokensOut, latencyMs, costUsd, raw }
```

The runner, grader, scorer and reports are all adapter-agnostic.

## Suite contract

A suite is data, not code:

```jsonc
{
  "id": "string",
  "title": "string",
  "model": "claude-opus-4-8",
  "configs": [{ "id", "target": "CLAUDE.md", "file" | "content" }],
  "tasks":   [{ "id", "prompt", "filesDir" | "files", "test": { "cmd", "cwd"? } }]
}
```

Invariant: **every task must have a `test.cmd`**. No test, no objective grade, no place in a suite.

## Why no TypeScript / build step / deps

- A benchmark's credibility is inversely proportional to how much you have to trust to run it.
- Pure `.mjs` runs on any Node ≥18 with `node bin/claudebench.mjs` — nothing to compile, nothing to
  audit in `node_modules`.
- The cost is no static types; we offset it with unit tests on the parts that matter (the math).

## Testing strategy

- `test/scorer.test.mjs` covers the statistics and scoring/verdict logic — the only places a bug
  would silently corrupt a published number.
- Suite *task* tests (under `suites/*/tasks/`) are **not** part of `npm test`; they are fixtures the
  grader runs inside isolated workspaces. `npm test` runs the files in `test/` explicitly (not a
  bare `node --test`, which would glob the suite task tests too); add new test files to the script.
- CI runs `npm test` and `claudebench demo` (replay, free) on every push.
