# ClaudeBench Methodology

This document explains exactly how a score is produced, why each choice was made, and — just as
important — **what these numbers cannot prove**. If you don't trust the method, the score is worthless.

## 1. The core problem: LLMs are stochastic

The same prompt to the same model does not give the same output twice. Causes:

- Sampling temperature > 0.
- Server-side batching and kernel nondeterminism (you can get variation even at temperature 0).
- Floating-point non-associativity across hardware.

**Consequence:** any benchmark that reports a single exact number ("score: 84") is either running
one trial (statistically meaningless) or hiding variance. ClaudeBench refuses to do either.

## 2. The unit of measurement: pass rate

For a given config, we run every task `trials` times. Each (config, task, trial) yields one
**Bernoulli outcome**: the task's test command exited 0 (pass) or it didn't (fail).

A config's score is its overall pass rate across all trials:

```
score = round(100 × successes / n)        where n = tasks × trials
```

Nothing else is in the headline score. See §6 for why.

## 3. The interval: Wilson score, 95%

A pass rate of 84/100 is not "84%". It's "84%, give or take". We quantify the give-or-take with a
**Wilson score interval** rather than the textbook normal approximation `p ± z·√(p(1−p)/n)`.

Why Wilson:

- The normal approximation produces nonsense at the edges — bounds below 0 or above 1 — and
  benchmark results live at the edges ("10/10 passed!").
- Wilson stays inside [0, 1] and behaves well for small `n`.
- It's the interval used by mature A/B-testing tools, so it's defensible.

Implementation: [`src/engine/stats.mjs → wilson()`](../src/engine/stats.mjs), unit-tested at the
0%, 100% and middle cases.

## 4. The verdict: two-proportion significance test

Comparing two configs, we ask the only question that matters: **is the difference real?**

- We run a **pooled two-proportion z-test** between the top config and the runner-up.
- If `p < α` (default `α = 0.05`), the verdict is **SIGNIFICANT** and we name a winner.
- Otherwise the verdict is **INCONCLUSIVE** — explicitly *no winner*, with the observed gap and
  p-value shown so you can decide whether to run more trials.

`INCONCLUSIVE` is the most valuable output in the tool. It is the honest end to most "X is better"
arguments. We would rather report a tie than manufacture a winner.

A visual sanity check (do the 95% intervals overlap?) is shown alongside the formal test.

## 5. Grading: objective, test-based, no LLM judge

A task passes **iff** its declared `test.cmd` exits 0 in the workspace after the agent has run.

We deliberately do **not** use an LLM to grade outputs:

- An LLM judge carries the same variance and bias as the system under test (circularity).
- Test exit codes are objective, cheap, and **independently re-runnable** by anyone auditing a run.

The cost of this rigor: ClaudeBench can only benchmark tasks reducible to a passing test. We treat
that as a discipline, not a limitation — if you can't write the test, you don't actually know what
"better" means for that task.

## 6. Why tokens/latency/cost are NOT in the score

It is tempting to blend everything into one number (e.g. `score = pass − λ·tokens`). We don't,
because the weighting λ is an *opinion*, and burying an opinion inside a headline number is exactly
how benchmarks lose trust.

Instead:

- **Headline = pass rate.** Objective, no opinion required.
- **Tokens, latency, cost = separate columns.** The reader applies their own trade-off.
- An **opt-in** `efficiencyScore(weights)` exists for those who want a composite — but the weights
  are passed in and printed, never hidden.

## 7. Reproducibility model

We separate two things that are usually conflated:

| | Deterministic? | How |
|---|---|---|
| **Generation** (model producing output) | ❌ No | Inherent to LLMs. We handle it with N trials + intervals. |
| **Scoring** (artifact → numbers) | ✅ Yes, bit-exact | `replay` recomputes from the saved records. |

Every live run writes an artifact containing every trial's pass/fail and token usage, plus:

- `suiteHash` — content hash of all configs + tasks. Change a task, the hash changes.
- `recordsHash` — hash of the outcome records. Tamper with results, the hash changes.
- `model`, `createdAt`, `mode`.

So "reproducible" means: **re-scoring an artifact gives the identical number forever**, and
**re-running live gives a result consistent with the stated interval**. That is the strongest
reproducibility claim an honest LLM benchmark can make.

## 8. Known limitations (read this before quoting a number)

- **Task validity.** A suite only measures what its tasks measure. A `CLAUDE.md` that helps on
  parsing tasks may not generalize. Don't over-claim from one suite.
- **Trial budget.** Tight intervals need many trials, which cost money. Small `n` → wide intervals
  → more `INCONCLUSIVE`. That's correct behavior, not a bug.
- **Model drift.** Results are tied to a model version. Re-run when the model changes.
- **Workspace leakage.** Tasks must be self-contained and hermetic, or trials aren't independent.
- **Gaming.** A task whose tests are visible to the agent can be gamed. Keep grading robust.

If a result matters, run it live, with enough trials that the interval is tight, and publish the
artifact. Anything less is an anecdote.
