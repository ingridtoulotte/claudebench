<div align="center">

# ⬡ ClaudeBench

### Stop arguing about prompts. Measure them.

A reproducible benchmark harness for **Claude Code** workflows — prompts, `CLAUDE.md` files,
memory strategies, MCP stacks. Run the same tasks under each setup, get a score with a
**confidence interval**, and find out whether the difference is real or just noise.

[![CI](https://github.com/ingridtoulotte/claudebench/actions/workflows/ci.yml/badge.svg)](https://github.com/ingridtoulotte/claudebench/actions/workflows/ci.yml)
[![node](https://img.shields.io/badge/node-%E2%89%A518-58a6ff)](package.json)
[![runtime deps](https://img.shields.io/badge/runtime%20deps-0-3fb950)](package.json)
[![no LLM judge](https://img.shields.io/badge/grading-test--based-3fb950)](docs/METHODOLOGY.md)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**[60-second demo](#60-second-demo--no-api-key-needed)** · **[Why it's not snake oil](#why-this-isnt-snake-oil)** · **[Write a suite](#write-your-own-suite)** · **[Methodology](docs/METHODOLOGY.md)**

</div>

---

> *"This CLAUDE.md is better."*
> *"This prompt saves tokens."*
> *"This memory setup works best."*
>
> Cool. **Show the ClaudeBench results.**

The Claude Code ecosystem runs on confident claims and zero evidence. ClaudeBench turns
"I think it's better" into "it's **+24pp** better, **p<0.001**, here's the run you can replay."

> ⭐ **If you've ever guessed whether a `CLAUDE.md` change actually helped, star the repo** — it's the fastest way to push for more suites.

---

## 60-second demo — no API key needed

```bash
npx github:ingridtoulotte/claudebench demo
```

```
⬡ ClaudeBench  ·  suite claude-md  ·  model claude-opus-4-8  ·  trials 90×2

╭─ RESULTS ──────────────────────────────────────────────────────────────────────╮
│     CONFIG         SCORE  PASS RATE  (95% CI)         TOKENS  LATENCY     COST │
│ ●   terse-rules       88  ███████████[░] 88% 79%–93%    7.8k     7.7s  $0.2177 │
│ ○   verbose-rules     63  ███████[█░]░░░ 63% 53%–73%   12.4k     9.0s  $0.3048 │
╰────────────────────────────────────────────────────────────────────────────────╯

  VERDICT  terse-rules wins   SIGNIFICANT   p=0.000
           +24.4pp pass rate   -37.0% tokens   -15.4% latency

  reproduce  npx claudebench replay run-06a65a2f8f36     suite 4fca3b6c8589
```

<div align="center">
<img src="assets/example-claude-md.svg" width="640" alt="ClaudeBench comparison scorecard: terse-rules beats verbose-rules by +24.4pp, significant at p=0.000">
</div>

The demo ships with a **recorded fixture**, so it runs instantly, costs nothing, and shows
the same result on every machine. Point it at the real CLI with `--live` when you want fresh numbers.

---

## Install

Zero runtime dependencies, no build step. Pick whichever you like:

```bash
# 1) zero-install — run straight from GitHub
npx github:ingridtoulotte/claudebench demo

# 2) clone it (you'll want this to write your own suites)
git clone https://github.com/ingridtoulotte/claudebench
cd claudebench
node bin/claudebench.mjs demo          # free, offline, deterministic
npm test                              # the trust core, ~120 lines of stats, all green
```

Requires **Node ≥ 18**. Live runs additionally need the [Claude Code CLI](https://docs.claude.com/en/docs/claude-code) on your `PATH`.

---

## Why this isn't snake oil

LLM output is **non-deterministic** — temperature, server-side batching, and floating-point
nondeterminism mean the same prompt gives different results run to run. Any "benchmark" that
prints a single exact score is lying to you. ClaudeBench is built around that fact instead of
hiding it:

| Principle | What it means in practice |
|---|---|
| 🎲 **Statistical, not absolute** | Every config runs **N trials**. The score is a pass rate with a **Wilson 95% confidence interval**, not a fake point number. |
| ⚖️ **Winners must be significant** | A two-proportion test decides the verdict. If the intervals overlap, ClaudeBench says **INCONCLUSIVE** instead of crowning noise. |
| 🧪 **Objective grading, no LLM judge** | A task passes iff its **test suite exits 0**. No model grading another model. You can re-run the exact command yourself. |
| 📼 **Record / replay** | Live runs save every transcript + token count to a hashed artifact. `replay` re-scores it **bit-for-bit**, free and offline. |
| 🔓 **Zero black boxes** | Zero runtime dependencies. The scoring math is ~120 lines of commented, unit-tested code in [`src/engine/stats.mjs`](src/engine/stats.mjs). |

> The single most important number on the scorecard isn't the score — it's the **verdict**.
> `INCONCLUSIVE` is a feature. It's the word that ends most of these arguments honestly:

<div align="center">
<img src="assets/example-inconclusive.svg" width="640" alt="ClaudeBench INCONCLUSIVE scorecard: two memory configs whose confidence intervals overlap, no significant winner at p=0.446">
</div>

Two memory strategies, 40 trials each, an 8-point gap — and ClaudeBench still **refuses to crown a winner**, because the intervals overlap (p=0.446). Most "this is obviously better" claims die exactly here.

---

## How people compare Claude Code setups today

| Today's method | The problem | ClaudeBench |
|---|---|---|
| **Vibes** — *"this one feels smarter"* | Unfalsifiable, unshareable, irreproducible | A replayable pass rate + confidence interval |
| **One good run** — *"it worked for me!"* | n=1 is pure noise on a stochastic model | N trials + a significance test |
| **Counting tokens** | Cheaper ≠ better if it fails the task | Tokens sit *beside* pass rate, never blended into it |
| **LLM-as-judge evals** | A model grading a model — same bias and variance | Objective test exit codes you can re-run yourself |
| **Generic eval frameworks** | Built for raw API prompts, not the Claude Code agent loop | First-class `CLAUDE.md` / memory / MCP configs via headless `claude -p` |

---

## How it works

```
   suite.json                run                 grade                score
  ┌──────────┐   for each   ┌──────────┐  test  ┌─────────┐  N×    ┌──────────┐
  │ configs  │ ─ config × ─▶│ Claude   │ ─pass─▶ │ exit 0? │ ─────▶ │ pass rate│
  │ tasks    │   task ×     │ Code CLI │  /fail  │ (hidden │ trials │ + 95% CI │
  │ trials   │   trial      │ headless │         │  tests) │        │ + tokens │
  └──────────┘              └──────────┘         └─────────┘        └──────────┘
                                  │                                       │
                                  └────────── records ───────────────────┘
                                   saved as a replayable run artifact
```

1. **A suite** declares the configs to compare, the coding tasks, and how each task is graded.
2. **The runner** prepares an isolated workspace per trial (the config *is* the `CLAUDE.md`),
   runs Claude Code headlessly (`claude -p --output-format json`), then runs the task's tests.
3. **The scorer** aggregates pass/fail across trials into a rate + interval, with token, latency
   and cost stats alongside — never blended into the headline score.

---

## Commands

```bash
claudebench demo                          # bundled comparison, no key needed
claudebench compare claude-md --live      # run it for real, 20 trials/task
claudebench compare claude-md --live --trials 50
claudebench run claude-md --config terse-rules   # one config, detailed card
claudebench replay run-d1de24eb7f00       # re-score a saved run, exact + free
claudebench report run-d1de24eb7f00 --svg out.svg   # shareable SVG
claudebench list                          # available suites
```

> Cloned the repo? Every `claudebench …` above is `node bin/claudebench.mjs …`.

Every `compare`/`run` writes a full artifact to `.claudebench/runs/<id>.json` — the audit trail
behind the score.

---

## Benchmark categories

ClaudeBench suites are just JSON + a grader, so any debate that ends in passing tests is benchmarkable.

| Suite family | Question it settles | Status |
|---|---|:--:|
| **`claude-md`** | Terse rules vs verbose prose — which `CLAUDE.md` actually codes better? | ✅ shipped |
| **`prompt`** | Prompt A vs B vs C on identical tasks | 🔜 v0.2 |
| **`memory`** | none vs memory vs distilled vs generated memory | 🔜 v0.2 |
| **`context`** | fresh vs long vs compacted vs distilled session | 🔜 v0.3 |
| **`mcp`** | Does adding MCP server X help or just burn tokens? | 🔜 v0.3 |
| **`coding`** | bugfix / refactor / test-writing / docs task packs | 🟡 expanding |

---

## Write your own suite

```jsonc
// suites/my-suite/suite.json
{
  "id": "my-suite",
  "title": "My CLAUDE.md vs the default",
  "model": "claude-opus-4-8",
  "configs": [
    { "id": "mine",    "target": "CLAUDE.md", "file": "configs/mine.md" },
    { "id": "default", "target": "CLAUDE.md", "content": "" }
  ],
  "tasks": [
    {
      "id": "fix-the-parser",
      "prompt": "The tests in parser.test.js fail. Fix parser.js. Run `node --test`.",
      "filesDir": "tasks/fix-the-parser",
      "test": { "cmd": "node --test" }
    }
  ]
}
```

```bash
claudebench compare my-suite --live --trials 30
```

That's the whole contract: configs, tasks, a `test.cmd` that exits 0 on success. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the 5-minute loop and
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) for how to write tasks that measure what you think they measure.

---

## Trust & reproducibility

- **Re-score any run:** `claudebench replay <id>` reproduces the score exactly from the saved artifact.
- **Verify the suite is unchanged:** every report prints a `suiteHash`; a changed task changes the hash.
- **Audit the grade:** open the artifact, run the same `test.cmd` yourself.
- **Pin the model:** the model id is recorded in every artifact; pricing tables travel with the run so old numbers stay interpretable.
- **Read the math:** [`stats.mjs`](src/engine/stats.mjs) is short and tested. No hidden weights.

Full method, including the limits of what these numbers can prove, is in [docs/METHODOLOGY.md](docs/METHODOLOGY.md).

---

## FAQ

**Isn't a single pass/fail score reductive?**
Yes — that's why tokens, latency and cost sit next to it as separate columns, never folded in.
A cheaper config that fails more tasks isn't "better"; *you* weigh the trade-off.

**Why test-based grading instead of an LLM judge?**
Because an LLM judge has the same variance and bias as the thing under test. Tests are boring,
objective, and re-runnable. If a question can't be reduced to a passing test, ClaudeBench is
honest that it can't measure it (yet).

**Can two configs tie?**
Constantly. ClaudeBench reports `INCONCLUSIVE` whenever the difference doesn't clear significance.
Most "this is better" claims die here.

**Does it cost money?**
`demo` and `replay` are free and offline. `--live` calls Claude Code for real and costs whatever
those tokens cost — shown in the cost column so you can see the price of your own benchmark.

**Why zero dependencies?**
A benchmark tool that pulls 400 transitive packages is asking you to trust 400 things. This pulls none.

**Why `npx github:…` and not `npx claudebench`?**
The package isn't on npm yet (the short form lands in v0.2). The GitHub form runs the exact same
code, today, with zero install.

---

## Roadmap

- **v0.1 (now)** — engine, statistical scoring, `compare`/`replay`/`report`, `claude-md` suite, SVG export.
- **v0.2** — `prompt` + `memory` suites, npm package (`npx claudebench`), HTML report, `claudebench init` scaffolder, leaderboard JSON.
- **v0.3** — `context` + `mcp` suites, Claude API adapter (not just the CLI), GitHub Action, hosted public leaderboard.
- **v1.0** — community suite registry, regression tracking across model versions, "ClaudeBench verified" badge.

---

## Contributing

New suites are the highest-value contribution. A good suite is a real debate reduced to passing
tests. Open a PR with `suites/<name>/` and a recorded fixture so the demo stays free — start from
[`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), or
[propose a suite as an issue](https://github.com/ingridtoulotte/claudebench/issues/new?template=propose-a-suite.yml).

## License

MIT © [Ingrid Toulotte](https://github.com/ingridtoulotte). See [LICENSE](LICENSE).

<div align="center">
<br>

**If ClaudeBench ended even one "trust me, it's better" argument for you — [⭐ star it](https://github.com/ingridtoulotte/claudebench) so the next person measures instead of guesses.**

</div>
