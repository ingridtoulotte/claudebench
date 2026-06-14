# Changelog

All notable changes to ClaudeBench are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/), and the project
adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Second example scorecard showing an `INCONCLUSIVE` verdict (the signature output).
- `scripts/gen-example-svgs.mjs` — regenerates the README scorecards from real engine code.
- `CONTRIBUTING.md`, `CHANGELOG.md`, and a "propose a suite" issue template.

## [0.1.0] — 2026-06-13

First public release.

### Added
- **Engine** — `runSuite` (live + replay), `scoreConfig`, `compare`, and the statistics core
  (`wilson`, `twoProportionTest`, percentile/mean/stddev) in pure dependency-free Node ESM.
- **Statistically-honest scoring** — pass rate with a Wilson 95% confidence interval; a pooled
  two-proportion z-test decides `SIGNIFICANT` vs `INCONCLUSIVE`.
- **Test-based grading** — a task passes iff its `test.cmd` exits `0`. No LLM-as-judge.
- **Record / replay** — every live run saves a hashed artifact (`suiteHash`, `recordsHash`)
  that `replay` re-scores bit-for-bit, free and offline.
- **CLI** — `demo`, `compare`, `run`, `replay`, `report`, `list`.
- **Reports** — ANSI terminal scorecard, single-config card, and self-contained SVG export.
- **`claude-md` suite** — terse vs verbose `CLAUDE.md`, with a bundled fixture so the demo is free.
- **CI** — unit tests on Node 18/20/22, fixture freshness check, and a free replay demo run.

[Unreleased]: https://github.com/ingridtoulotte/claudebench/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ingridtoulotte/claudebench/releases/tag/v0.1.0
