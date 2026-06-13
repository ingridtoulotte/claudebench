// grader.mjs — objective, test-based grading. No LLM judges.
//
// A task passes iff its declared test command exits 0 in the workspace after
// the agent has run. That is the entire definition. It is auditable (you can
// run the same command), deterministic given the agent's output, and immune to
// the "LLM grades LLM" circularity that quietly wrecks most eval setups.
import { spawn } from "node:child_process";

/**
 * @param {object} task  { id, test: { cmd, cwd? } }
 * @param {object} opts  { cwd, timeoutMs }
 * @returns {Promise<{passed:boolean, code:number, stdout:string, stderr:string}>}
 */
export async function gradeTask(task, opts = {}) {
  if (!task.test || !task.test.cmd) {
    throw new Error(`task ${task.id} has no test.cmd — every task must be objectively gradable`);
  }
  const cwd = task.test.cwd ? `${opts.cwd}/${task.test.cwd}` : opts.cwd;
  const result = await exec(task.test.cmd, { cwd, timeoutMs: opts.timeoutMs ?? 120000 });
  return { passed: result.code === 0, ...result };
}

function exec(cmd, { cwd, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, { cwd, shell: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout, stderr: String(e) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}
