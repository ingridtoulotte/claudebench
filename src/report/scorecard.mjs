// scorecard.mjs — the screenshot. Everything else exists to feed this.
import { c } from "../util/colors.mjs";
import { box, bar, columns, sparkline, gradient } from "./table.mjs";

const LOGO = "⬡ ClaudeBench";

function fmtTokens(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(Math.round(n));
}
function fmtMs(ms) {
  return (ms / 1000).toFixed(1) + "s";
}
function fmtPct(x) {
  return (x * 100).toFixed(0) + "%";
}
function sign(x, unit = "", digits = 1) {
  const s = x >= 0 ? "+" : "";
  return `${s}${x.toFixed(digits)}${unit}`;
}

/**
 * Render the comparison scorecard.
 * @param {object} result        output of compare()
 * @param {object} meta          { suite, model, trialsPerConfig, suiteHash, runId }
 */
export function renderScorecard(result, meta) {
  const { ranked, verdict } = result;
  const lines = [];

  // ── header ────────────────────────────────────────────────────────────
  const header =
    c.bold(c.cyan(LOGO)) +
    c.gray("  ·  ") +
    `suite ${c.bold(meta.suite)}` +
    c.gray("  ·  ") +
    `model ${c.bold(meta.model)}` +
    c.gray("  ·  ") +
    `trials ${c.bold(meta.trialsPerConfig)}×${ranked.length}`;
  lines.push("", header, "");

  // ── results table ─────────────────────────────────────────────────────
  const rows = [
    [
      c.gray("  "),
      c.bold(c.gray("CONFIG")),
      c.bold(c.gray("SCORE")),
      c.bold(c.gray("PASS RATE  (95% CI)")),
      c.bold(c.gray("TOKENS")),
      c.bold(c.gray("LATENCY")),
      c.bold(c.gray("COST")),
    ],
  ];
  ranked.forEach((s, i) => {
    const medal = i === 0 ? c.yellow("●") : c.gray("○");
    const tone = gradient(s.passRate);
    const ciStr = `${fmtPct(s.passRate)} ${c.gray(fmtPct(s.ci.lo) + "–" + fmtPct(s.ci.hi))}`;
    rows.push([
      medal,
      i === 0 ? c.bold(s.configId) : s.configId,
      tone(c.bold(String(s.score).padStart(3))),
      bar(s.passRate, 1, 14, { ci: s.ci }) + " " + ciStr,
      fmtTokens(s.tokens.total),
      fmtMs(s.latency.p50),
      "$" + s.cost.mean.toFixed(4),
    ]);
  });
  const table = columns(rows, { align: ["left", "left", "right", "left", "right", "right", "right"], gap: 2 });
  lines.push(box(table.split("\n"), { title: "RESULTS", color: c.cyan }));
  lines.push("");

  // ── verdict ───────────────────────────────────────────────────────────
  if (verdict.kind === "single") {
    lines.push(c.bold("  VERDICT  ") + `only one config — nothing to compare`);
  } else if (verdict.kind === "significant") {
    const sigBadge = c.bgGreen(c.bold(" SIGNIFICANT "));
    lines.push(
      c.bold("  VERDICT  ") +
        c.green(c.bold(verdict.winner)) +
        " wins  " +
        sigBadge +
        "  " +
        c.gray(`p=${verdict.p.toFixed(3)}`)
    );
    lines.push(
      "           " +
        c.green(sign(verdict.deltaPp, "pp")) +
        c.gray(" pass rate") +
        "   " +
        toneDelta(-verdict.tokenDeltaPct, sign(verdict.tokenDeltaPct, "%") + c.gray(" tokens")) +
        "   " +
        toneDelta(-verdict.latencyDeltaPct, sign(verdict.latencyDeltaPct, "%") + c.gray(" latency"))
    );
  } else {
    const badge = c.bgRed(c.bold(" INCONCLUSIVE "));
    lines.push(
      c.bold("  VERDICT  ") +
        badge +
        "  " +
        c.yellow("no statistically significant winner") +
        c.gray(`  (Δ ${sign(verdict.deltaPp, "pp")}, p=${verdict.p.toFixed(3)})`)
    );
    lines.push(
      "           " +
        c.gray("confidence intervals overlap — run more trials or accept they tie")
    );
  }
  lines.push("");

  // ── reproducibility footer ──────────────────────────────────────────────
  lines.push(
    c.gray("  reproduce  ") +
      c.cyan(`npx claudebench replay ${meta.runId}`) +
      c.gray(`     suite ${meta.suiteHash}`)
  );
  lines.push("");
  return lines.join("\n");
}

function toneDelta(goodness, text) {
  // goodness > 0 means the change is favourable (e.g. fewer tokens)
  if (goodness > 0) return c.green(text);
  if (goodness < 0) return c.red(text);
  return c.gray(text);
}

/** Compact per-config card used by `claudebench run` (single config, no compare). */
export function renderSingleCard(s, meta) {
  const tone = gradient(s.passRate);
  const lines = [
    c.bold(s.configId),
    "",
    tone(c.bold(`  score ${s.score}`)) + c.gray(`  (pass ${fmtPct(s.passRate)}, 95% CI ${fmtPct(s.ci.lo)}–${fmtPct(s.ci.hi)})`),
    bar(s.passRate, 1, 28, { ci: s.ci }),
    "",
    ...columns(
      [
        [c.gray("tokens"), fmtTokens(s.tokens.total) + c.gray(` (±${fmtTokens(s.tokens.totalSd)})`)],
        [c.gray("latency"), `p50 ${fmtMs(s.latency.p50)}  p95 ${fmtMs(s.latency.p95)}`],
        [c.gray("cost"), "$" + s.cost.mean.toFixed(4) + c.gray("/task")],
        [c.gray("trials"), `${s.successes}/${s.n} passed`],
      ],
      { align: ["left", "left"], gap: 3 }
    ).split("\n"),
  ];
  return box(lines, { title: `${LOGO}  ·  ${meta.suite}`, color: c.cyan });
}
