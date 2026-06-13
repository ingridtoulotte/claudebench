// hash.mjs — deterministic content hashing for reproducibility receipts.
import { createHash } from "node:crypto";

/** SHA-256 hex of any JSON-serialisable value, with stable key ordering. */
export function hashJson(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

/** Short 12-char hash, used in report footers ("suite a1b2c3d4e5f6"). */
export function shortHash(value) {
  return hashJson(value).slice(0, 12);
}

/** JSON.stringify with deterministically sorted object keys at every depth. */
export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") +
    "}"
  );
}
