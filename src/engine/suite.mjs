// suite.mjs — load and resolve a suite definition from disk.
import { readFile } from "node:fs/promises";
import { dirname, resolve, isAbsolute } from "node:path";

/** Load suite.json and inline config file contents + resolve task dirs. */
export async function loadSuite(suitePath) {
  const raw = JSON.parse(await readFile(suitePath, "utf8"));
  const baseDir = dirname(resolve(suitePath));

  const configs = await Promise.all(
    raw.configs.map(async (cfg) => ({
      ...cfg,
      content: cfg.content ?? (cfg.file ? await readFile(resolve(baseDir, cfg.file), "utf8") : ""),
    }))
  );

  const tasks = raw.tasks.map((task) => ({
    ...task,
    fixtureDir: task.filesDir ? resolve(baseDir, task.filesDir) : undefined,
  }));

  return { ...raw, configs, tasks, baseDir };
}

/** Resolve a suite name to its suite.json path (built-in or filesystem). */
export function resolveSuitePath(nameOrPath, builtinsDir) {
  if (nameOrPath.endsWith(".json")) return resolve(nameOrPath);
  if (isAbsolute(nameOrPath)) return resolve(nameOrPath, "suite.json");
  return resolve(builtinsDir, nameOrPath, "suite.json");
}
