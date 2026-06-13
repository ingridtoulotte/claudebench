// stats.mjs — statistics primitives for ClaudeBench.
//
// Everything here is intentionally dependency-free and auditable. The whole
// credibility of ClaudeBench rests on these functions, so they are kept small,
// commented, and unit-tested (see test/scorer.test.mjs).

/** Arithmetic mean of an array of numbers. */
export function mean(xs) {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Sample standard deviation (n-1 / Bessel's correction). */
export function stddev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Linear-interpolated percentile (p in [0,100]). */
export function percentile(xs, p) {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/**
 * Wilson score interval for a binomial proportion.
 *
 * Why Wilson and not the textbook normal approximation (p ± z·√(p(1-p)/n))?
 * The normal approximation breaks badly for the small n and extreme p (0% /
 * 100% pass rates) that benchmark runs routinely produce — it can even give
 * bounds outside [0,1]. Wilson stays sensible at the edges, which is exactly
 * where benchmark debates live ("it passed 10/10!"). This is the same interval
 * used by reputable A/B testing tools.
 *
 * @param {number} successes  number of passing trials
 * @param {number} n          total trials
 * @param {number} z          z for the confidence level (1.96 = 95%)
 * @returns {{point:number, lo:number, hi:number}} proportions in [0,1]
 */
export function wilson(successes, n, z = 1.96) {
  if (n === 0) return { point: 0, lo: 0, hi: 0 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return {
    point: p,
    lo: Math.max(0, center - margin),
    hi: Math.min(1, center + margin),
  };
}

/**
 * Two-proportion z-test (pooled). Returns the z statistic and a two-sided
 * p-value. Used to answer the only question that matters in a comparison:
 * "is B actually better than A, or is this noise?"
 */
export function twoProportionTest(s1, n1, s2, n2) {
  if (n1 === 0 || n2 === 0) return { z: 0, p: 1 };
  const p1 = s1 / n1;
  const p2 = s2 / n2;
  const pPool = (s1 + s2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return { z: 0, p: 1 };
  const z = (p2 - p1) / se;
  return { z, p: 2 * (1 - normalCdf(Math.abs(z))) };
}

/** Standard normal CDF via Abramowitz & Stegun 7.1.26 (max error ~7.5e-8). */
export function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-(x * x) / 2);
  const prob =
    d *
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - prob : prob;
}

/** Do two confidence intervals overlap? Cheap visual significance heuristic. */
export function intervalsOverlap(a, b) {
  return a.lo <= b.hi && b.lo <= a.hi;
}
