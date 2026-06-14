# Contributing to ClaudeBench

The single highest-value contribution is **a new suite**: a real argument from the Claude
Code community, reduced to a benchmark anyone can replay.

> "Terse `CLAUDE.md` beats verbose." → that's `suites/claude-md`.
> "Memory hurts more than it helps on long tasks." → that could be your suite.

## The 5-minute contribution loop

```bash
git clone https://github.com/ingridtoulotte/claudebench
cd claudebench
node bin/claudebench.mjs demo      # confirm it runs (replay, free, offline)
npm test                           # confirm the math is green
```

## Anatomy of a good suite

A suite lives in `suites/<your-suite>/` and is **data, not code**:

```
suites/my-suite/
  suite.json            # configs to compare + tasks + how each is graded
  configs/*.md          # the CLAUDE.md / prompt variants under test
  tasks/<task>/         # the starter files an agent edits, + a hidden grading test
```

`suite.json` contract:

```jsonc
{
  "id": "my-suite",
  "title": "One-line debate this settles",
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

**The one invariant:** every task has a `test.cmd` that exits `0` on success and non-zero on
failure. No test, no objective grade, no place in a suite. See
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) for how to write tasks that measure what you think
they measure (and the traps that make a task secretly gameable).

## Ship a fixture so the demo stays free

Live runs cost real tokens. So every suite ships with a **recorded fixture**
(`fixtures/<id>.json`) — a saved set of trials — so `claudebench demo` and CI run instantly,
offline, and for $0. Generate yours after a live run, or with the seeded generator:

```bash
node bin/claudebench.mjs compare my-suite --live --trials 30   # real run, saves an artifact
node scripts/gen-fixture.mjs                                    # (dev) seeded fixture
```

## Checklist before you open a PR

- [ ] `npm test` passes.
- [ ] `node bin/claudebench.mjs demo` and `node bin/claudebench.mjs list` show your suite.
- [ ] Your suite has a fixture so the demo stays free and deterministic.
- [ ] No runtime dependencies added (this stays a zero-dep project — see below).
- [ ] You ran `node scripts/gen-example-svgs.mjs` if you touched the renderers.

## Non-negotiables

- **Zero runtime dependencies.** A benchmark you have to trust 400 transitive packages to run is
  not a trustworthy benchmark. Dev-only tooling is fine; runtime `dependencies` are not.
- **No LLM-as-judge.** Grades come from test exit codes, never from a model scoring a model.
- **Honest verdicts.** Never widen significance thresholds to manufacture a winner. `INCONCLUSIVE`
  is a feature.

## Other welcome contributions

- New **tasks** for the existing `coding` pack (bugfix / refactor / test-writing / docs).
- A new **adapter** in `src/adapters/` (e.g. the Claude API directly) — see
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#the-one-extension-point-that-matters-adapters).
- Docs, FAQ entries, and methodology critiques. Finding a flaw in the stats is a top-tier PR.

By contributing you agree your work is released under the project's [MIT license](LICENSE).
