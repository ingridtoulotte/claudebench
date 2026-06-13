// scorer.mjs — turns raw trial records into auditable scores.
//
// Design stance (this is the part people will argue about, so it is explicit):
//
//   1. The HEADLINE score is pass rate, nothing else. pass rate is objective
//      (tests either pass or they don't) and needs no opinion to compute.
//      Score = round(100 * passRate). No magic blend of latency/tokens hidden
//      inside it — blending is exactly where benchmarks lose trust.
//
//   2. Tokens, latency and cost are reported ALONGSIDE the score as first-class
//      columns, never folded into it. A faster cheaper config that fails more
//      tasks is not "better"; the reader decides the trade-off, not us.
//
//   3. An OPTIONAL composite ("efficiency-adjusted score") exists for people
//      who want one number, but its weights are passed in and printed, so it is
//      never a black box.

import { mean, stddev, percentile, wilson, twoProportionTest, intervalsOverlap } from "./stats.mjs";

// Token prices (USD per 1M tokens). Update as Anthropic pricing changes; the
// active table is recorded in every report so old runs stay interpretable.
export const PRICING = {
  "claude-opus-4-8": { in: 15, out: 75 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  default: { in: 3, out: 15 },
};

function costUsd(model, tokensIn, tokensOut) {
  const p = PRICING[model] || PRICING.default;
  return (tokensIn / 1e6) * p.in + (tokensOut / 1e6) * p.out;
}

/**
 * Score one config from its trial records.
 * @param {string} configId
 * @param {Array<{passed:boolean, tokensIn:number, tokensOut:number, latencyMs:number}>} trials
 * @param {{model?:string, z?:number}} opts
 */
export function scoreConfig(configId, trials, opts = {}) {
  const model = opts.model || "default";
  const z = opts.z ?? 1.96;
  const n = trials.length;
  const successes = trials.filter((t) => t.passed).length;
  const ci = wilson(successes, n, z);

  const tokensTotal = trials.map((t) => t.tokensIn + t.tokensOut);
  const latencies = trials.map((t) => t.latencyMs);
  const costs = trials.map((t) => costUsd(model, t.tokensIn, t.tokensOut));

  return {
    configId,
    n,
    successes,
    passRate: ci.point,
    ci: { lo: ci.lo, hi: ci.hi },
    score: Math.round(ci.point * 100),
    tokens: {
      in: mean(trials.map((t) => t.tokensIn)),
      out: mean(trials.map((t) => t.tokensOut)),
      total: mean(tokensTotal),
      totalSd: stddev(tokensTotal),
    },
    latency: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      mean: mean(latencies),
    },
    cost: { mean: mean(costs), total: costs.reduce((a, b) => a + b, 0) },
  };
}

/**
 * Compare a baseline against one or more challengers. The verdict is the whole
 * point: we only crown a winner when the difference clears a significance bar.
 */
export function compare(scored, opts = {}) {
  const alpha = opts.alpha ?? 0.05;
  const ranked = [...scored].sort((a, b) => b.passRate - a.passRate);
  const top = ranked[0];
  const runnerUp = ranked[1];

  let verdict;
  if (!runnerUp) {
    verdict = { kind: "single", winner: top.configId };
  } else {
    const test = twoProportionTest(
      runnerUp.successes,
      runnerUp.n,
      top.successes,
      top.n
    );
    const overlap = intervalsOverlap(top.ci, runnerUp.ci);
    const significant = test.p < alpha;
    verdict = {
      kind: significant ? "significant" : "inconclusive",
      winner: significant ? top.configId : null,
      p: test.p,
      z: test.z,
      ciOverlap: overlap,
      deltaPp: (top.passRate - runnerUp.passRate) * 100, // percentage points
      tokenDeltaPct:
        runnerUp.tokens.total === 0
          ? 0
          : ((top.tokens.total - runnerUp.tokens.total) / runnerUp.tokens.total) * 100,
      latencyDeltaPct:
        runnerUp.latency.p50 === 0
          ? 0
          : ((top.latency.p50 - runnerUp.latency.p50) / runnerUp.latency.p50) * 100,
    };
  }
  return { ranked, verdict, alpha };
}

/**
 * Optional, opt-in composite. weights default to pass-rate-only so the headline
 * never changes unless the caller explicitly asks for trade-off weighting.
 */
export function efficiencyScore(s, weights = { pass: 1, cost: 0, latency: 0 }, refs = {}) {
  const passPart = s.passRate;
  const costPart = refs.maxCost ? 1 - s.cost.mean / refs.maxCost : 0;
  const latPart = refs.maxLatency ? 1 - s.latency.p50 / refs.maxLatency : 0;
  const w = weights.pass + weights.cost + weights.latency || 1;
  return Math.round(
    (100 * (weights.pass * passPart + weights.cost * costPart + weights.latency * latPart)) / w
  );
}
