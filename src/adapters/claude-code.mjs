// claude-code.mjs — adapter that drives the real Claude Code CLI headlessly.
//
// We invoke:   claude -p "<prompt>" --output-format json
// and read back the structured result (text + token usage + duration). This is
// the ONLY place that talks to a model, so swapping in another agent later (or
// the Claude API directly) means writing one more file in this folder.
import { spawn } from "node:child_process";

/**
 * Run one task attempt in a prepared workspace.
 * @param {object} task   { id, prompt }
 * @param {object} opts   { cwd, model, bin, timeoutMs }
 * @returns {Promise<{text:string, tokensIn:number, tokensOut:number, latencyMs:number, costUsd:number, raw:object}>}
 */
export async function runClaudeCode(task, opts = {}) {
  const bin = opts.bin || process.env.CLAUDEBENCH_CLAUDE_BIN || "claude";
  const args = ["-p", task.prompt, "--output-format", "json"];
  if (opts.model) args.push("--model", opts.model);

  const start = Date.now();
  const { stdout } = await exec(bin, args, { cwd: opts.cwd, timeoutMs: opts.timeoutMs ?? 600000 });
  const latencyMs = Date.now() - start;

  let raw = {};
  try {
    raw = JSON.parse(stdout);
  } catch {
    raw = { result: stdout };
  }
  // Claude Code's JSON output exposes usage under `usage`; fall back gracefully.
  const usage = raw.usage || raw.message?.usage || {};
  return {
    text: raw.result ?? raw.text ?? "",
    tokensIn: usage.input_tokens ?? 0,
    tokensOut: usage.output_tokens ?? 0,
    latencyMs: raw.duration_ms ?? latencyMs,
    costUsd: raw.total_cost_usd ?? 0,
    raw,
  };
}

function exec(cmd, args, { cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, shell: process.platform === "win32" });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`adapter timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout) reject(new Error(`claude exited ${code}: ${stderr.slice(0, 400)}`));
      else resolve({ stdout, stderr, code });
    });
  });
}
