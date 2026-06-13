// svg.mjs — render a comparison as a self-contained SVG (for READMEs / sharing).
// No deps; hand-built so the output is small and diff-friendly.

const esc = (s) => String(s).replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m]));

function pct(x) {
  return (x * 100).toFixed(0) + "%";
}
function tokens(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(Math.round(n));
}

export function renderSvg(result, meta) {
  const { ranked, verdict } = result;
  const W = 760;
  const rowH = 64;
  const top = 150;
  const H = top + ranked.length * rowH + 96;
  const bg = "#0d1117";
  const fg = "#e6edf3";
  const sub = "#7d8590";
  const accent = "#58a6ff";

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace">`);
  parts.push(`<rect width="${W}" height="${H}" rx="14" fill="${bg}"/>`);
  parts.push(`<text x="32" y="48" fill="${accent}" font-size="22" font-weight="700">⬡ ClaudeBench</text>`);
  parts.push(`<text x="32" y="78" fill="${sub}" font-size="13">suite ${esc(meta.suite)} · model ${esc(meta.model)} · ${meta.trialsPerConfig}×${ranked.length} trials</text>`);

  // column headers
  parts.push(`<text x="32" y="120" fill="${sub}" font-size="12" letter-spacing="1">CONFIG</text>`);
  parts.push(`<text x="300" y="120" fill="${sub}" font-size="12" letter-spacing="1">PASS RATE (95% CI)</text>`);
  parts.push(`<text x="620" y="120" fill="${sub}" font-size="12" letter-spacing="1">TOKENS</text>`);

  ranked.forEach((s, i) => {
    const y = top + i * rowH;
    const isTop = i === 0;
    const barX = 300;
    const barW = 280;
    const frac = s.passRate;
    const col = frac >= 0.8 ? "#3fb950" : frac >= 0.6 ? "#d29922" : "#f85149";
    parts.push(`<text x="32" y="${y + 24}" fill="${fg}" font-size="16" font-weight="${isTop ? 700 : 400}">${isTop ? "● " : "○ "}${esc(s.configId)}</text>`);
    parts.push(`<text x="32" y="${y + 44}" fill="${col}" font-size="22" font-weight="700">${s.score}</text>`);
    // bar track + fill
    parts.push(`<rect x="${barX}" y="${y + 8}" width="${barW}" height="14" rx="7" fill="#21262d"/>`);
    parts.push(`<rect x="${barX}" y="${y + 8}" width="${barW * frac}" height="14" rx="7" fill="${col}"/>`);
    // CI whisker
    const lo = barX + barW * s.ci.lo;
    const hi = barX + barW * s.ci.hi;
    parts.push(`<line x1="${lo}" y1="${y + 4}" x2="${lo}" y2="${y + 26}" stroke="${fg}" stroke-width="2"/>`);
    parts.push(`<line x1="${hi}" y1="${y + 4}" x2="${hi}" y2="${y + 26}" stroke="${fg}" stroke-width="2"/>`);
    parts.push(`<text x="${barX}" y="${y + 44}" fill="${sub}" font-size="13">${pct(frac)} (${pct(s.ci.lo)}–${pct(s.ci.hi)})</text>`);
    parts.push(`<text x="620" y="${y + 26}" fill="${fg}" font-size="15">${tokens(s.tokens.total)}</text>`);
  });

  // verdict bar
  const vy = top + ranked.length * rowH + 24;
  if (verdict.kind === "significant") {
    parts.push(`<rect x="32" y="${vy}" width="${W - 64}" height="44" rx="8" fill="#13301c" stroke="#2ea043"/>`);
    parts.push(`<text x="48" y="${vy + 28}" fill="#3fb950" font-size="15" font-weight="700">✓ ${esc(verdict.winner)} wins</text>`);
    parts.push(`<text x="220" y="${vy + 28}" fill="${fg}" font-size="14">+${verdict.deltaPp.toFixed(1)}pp · ${verdict.tokenDeltaPct.toFixed(1)}% tokens · p=${verdict.p.toFixed(3)}</text>`);
  } else if (verdict.kind === "inconclusive") {
    parts.push(`<rect x="32" y="${vy}" width="${W - 64}" height="44" rx="8" fill="#30221a" stroke="#bb8009"/>`);
    parts.push(`<text x="48" y="${vy + 28}" fill="#d29922" font-size="15" font-weight="700">⚠ inconclusive</text>`);
    parts.push(`<text x="220" y="${vy + 28}" fill="${fg}" font-size="14">no significant winner (Δ ${verdict.deltaPp.toFixed(1)}pp, p=${verdict.p.toFixed(3)})</text>`);
  }
  parts.push(`</svg>`);
  return parts.join("\n");
}
