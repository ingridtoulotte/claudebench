// Public library API. `import { runSuite, scoreConfig, compare } from "claudebench"`.
export { loadSuite, resolveSuitePath } from "./engine/suite.mjs";
export { runSuite } from "./engine/runner.mjs";
export { scoreConfig, compare, efficiencyScore, PRICING } from "./engine/scorer.mjs";
export { gradeTask } from "./engine/grader.mjs";
export { runClaudeCode } from "./adapters/claude-code.mjs";
export { wilson, twoProportionTest } from "./engine/stats.mjs";
export { renderScorecard, renderSingleCard } from "./report/scorecard.mjs";
export { renderSvg } from "./report/svg.mjs";
