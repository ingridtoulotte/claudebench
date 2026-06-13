import { test } from "node:test";
import assert from "node:assert/strict";
import { wilson, twoProportionTest, mean, stddev, percentile, normalCdf } from "../src/engine/stats.mjs";
import { scoreConfig, compare } from "../src/engine/scorer.mjs";

// ── stats ────────────────────────────────────────────────────────────────
test("wilson interval brackets the point estimate and stays in [0,1]", () => {
  const w = wilson(84, 100);
  assert.ok(Math.abs(w.point - 0.84) < 1e-9);
  assert.ok(w.lo > 0 && w.lo < 0.84);
  assert.ok(w.hi > 0.84 && w.hi < 1);
});

test("wilson handles the 100% edge without exceeding 1", () => {
  const w = wilson(20, 20);
  assert.equal(w.point, 1);
  assert.ok(w.hi <= 1);
  assert.ok(w.lo < 1, "lower bound must be < 1 even at a perfect score");
});

test("wilson handles the 0% edge without going negative", () => {
  const w = wilson(0, 20);
  assert.equal(w.point, 0);
  assert.ok(w.lo >= 0);
  assert.ok(w.hi > 0, "upper bound must be > 0 even at a zero score");
});

test("normalCdf matches known values", () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-3);
});

test("two-proportion test flags a clear difference and ignores a tie", () => {
  const big = twoProportionTest(50, 100, 80, 100);
  assert.ok(big.p < 0.001, "50% vs 80% over 100 trials should be significant");
  const tie = twoProportionTest(50, 100, 52, 100);
  assert.ok(tie.p > 0.05, "50% vs 52% should not be significant");
});

test("mean/stddev/percentile basics", () => {
  assert.equal(mean([2, 4, 6]), 4);
  assert.ok(Math.abs(stddev([2, 4, 6]) - 2) < 1e-9);
  assert.equal(percentile([1, 2, 3, 4], 50), 2.5);
});

// ── scoring ────────────────────────────────────────────────────────────────
function trials(passRate, n, tokens = 10000) {
  return Array.from({ length: n }, (_, i) => ({
    passed: i < Math.round(passRate * n),
    tokensIn: tokens * 0.8,
    tokensOut: tokens * 0.2,
    latencyMs: 8000,
  }));
}

test("scoreConfig produces a 0-100 score equal to rounded pass rate", () => {
  const s = scoreConfig("x", trials(0.84, 100));
  assert.equal(s.score, 84);
  assert.equal(s.n, 100);
  assert.equal(s.successes, 84);
});

test("compare crowns a winner only when the gap is significant", () => {
  const a = scoreConfig("A", trials(0.6, 90));
  const b = scoreConfig("B", trials(0.85, 90));
  const { verdict } = compare([a, b]);
  assert.equal(verdict.kind, "significant");
  assert.equal(verdict.winner, "B");
});

test("compare returns inconclusive on a near tie", () => {
  const a = scoreConfig("A", trials(0.7, 50));
  const b = scoreConfig("B", trials(0.74, 50));
  const { verdict } = compare([a, b]);
  assert.equal(verdict.kind, "inconclusive");
  assert.equal(verdict.winner, null);
});
