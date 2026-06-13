// colors.mjs — hand-rolled ANSI styling. Zero deps on purpose.
//
// Respects NO_COLOR (https://no-color.org) and non-TTY output so reports stay
// clean when piped to files or CI logs.

const enabled =
  !process.env.NO_COLOR &&
  process.env.TERM !== "dumb" &&
  (process.stdout.isTTY || process.env.FORCE_COLOR);

const wrap = (open, close) => (s) =>
  enabled ? `\x1b[${open}m${s}\x1b[${close}m` : String(s);

export const c = {
  enabled,
  reset: "\x1b[0m",
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  italic: wrap(3, 23),
  underline: wrap(4, 24),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
  white: wrap(97, 39),
  bgGreen: wrap(42, 49),
  bgRed: wrap(41, 49),
  bgBlue: wrap(44, 49),
};

/** Truecolor foreground (24-bit). Falls back to plain when color disabled. */
export function rgb(r, g, b, s) {
  return enabled ? `\x1b[38;2;${r};${g};${b}m${s}\x1b[39m` : String(s);
}

/** Visible length ignoring ANSI escape codes — needed for alignment. */
export function visibleLen(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

/** Pad a possibly-colored string to a visible width. */
export function pad(s, width, align = "left") {
  const len = visibleLen(s);
  const gap = Math.max(0, width - len);
  if (align === "right") return " ".repeat(gap) + s;
  if (align === "center") {
    const l = Math.floor(gap / 2);
    return " ".repeat(l) + s + " ".repeat(gap - l);
  }
  return s + " ".repeat(gap);
}
