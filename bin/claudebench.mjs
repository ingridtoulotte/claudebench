#!/usr/bin/env node
import { main } from "../src/cli.mjs";

main(process.argv.slice(2)).catch((err) => {
  console.error("\x1b[31merror:\x1b[39m " + (err?.stack || err?.message || err));
  process.exit(1);
});
