// table.mjs — terminal drawing primitives (boxes, bars, sparklines).
// All zero-dep, all ANSI-width aware so colored cells still align.
import { c, rgb, visibleLen, pad } from "../util/colors.mjs";

const BOX = {
  tl: "╭", tr: "╮", bl: "╰", br: "╯",
  h: "─", v: "│", ml: "├", mr: "┤", mt: "┬", mb: "┴", x: "┼",
};

/** A rounded box around pre-rendered lines, with an optional title tab. */
export function box(lines, { title = "", color = c.cyan } = {}) {
  const width = Math.max(...lines.map(visibleLen), visibleLen(title) + 2, 10);
  const out = [];
  const top = title
    ? color(BOX.tl + BOX.h + " ") + c.bold(title) + " " +
      color(BOX.h.repeat(Math.max(0, width - visibleLen(title) - 1)) + BOX.tr)
    : color(BOX.tl + BOX.h.repeat(width + 2) + BOX.tr);
  out.push(top);
  for (const line of lines) {
    out.push(color(BOX.v) + " " + pad(line, width) + " " + color(BOX.v));
  }
  out.push(color(BOX.bl + BOX.h.repeat(width + 2) + BOX.br));
  return out.join("\n");
}

/** Horizontal bar, optionally with a faint confidence-interval whisker. */
export function bar(value, max, width = 24, { color, ci } = {}) {
  const frac = max > 0 ? value / max : 0;
  const filled = Math.round(frac * width);
  const tone = color || gradient(frac);
  let cells = [];
  for (let i = 0; i < width; i++) {
    if (i < filled) cells.push(tone("█"));
    else cells.push(c.gray("░"));
  }
  if (ci && max > 0) {
    // Overlay the confidence interval as bracket markers, keeping bar width fixed.
    const lo = Math.max(0, Math.min(width - 1, Math.round((ci.lo / max) * width)));
    const hi = Math.max(0, Math.min(width - 1, Math.round((ci.hi / max) * width)));
    cells[lo] = c.bold(c.white("["));
    cells[hi] = c.bold(c.white("]"));
  }
  return cells.join("");
}

/** Unicode sparkline from a numeric series. */
export function sparkline(xs) {
  if (xs.length === 0) return "";
  const ticks = "▁▂▃▄▅▆▇█";
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const span = max - min || 1;
  return xs
    .map((x) => ticks[Math.min(ticks.length - 1, Math.floor(((x - min) / span) * (ticks.length - 1)))])
    .join("");
}

/** Color ramp red→yellow→green for a fraction in [0,1]. */
export function gradient(frac) {
  const f = Math.max(0, Math.min(1, frac));
  let r, g;
  if (f < 0.5) { r = 235; g = Math.round(80 + f * 2 * 175); }
  else { r = Math.round(235 - (f - 0.5) * 2 * 175); g = 235; }
  return (s) => rgb(r, g, 90, s);
}

/** Simple aligned column layout. rows = array of arrays of (possibly colored) cells. */
export function columns(rows, { align = [], gap = 2 } = {}) {
  const widths = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] || 0, visibleLen(String(cell)));
    });
  }
  return rows
    .map((row) =>
      row.map((cell, i) => pad(String(cell), widths[i], align[i] || "left")).join(" ".repeat(gap))
    )
    .join("\n");
}
