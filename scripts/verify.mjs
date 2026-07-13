#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const profiles = {
  fast: ["npx tsc --noEmit", "npm run lint", "npm test", "npm run build"],
  db: ["npm run db:local:setup"],
  all: ["npx tsc --noEmit", "npm run lint", "npm test", "npm run build", "npm run db:local:setup"],
};

const profile = process.argv[2] ?? "fast";
const commands = profiles[profile];

if (!commands) {
  console.error(`Unknown verify profile: ${profile}`);
  console.error(`Available profiles: ${Object.keys(profiles).join(", ")}`);
  process.exit(1);
}

for (const command of commands) {
  console.log(`$ ${command}`);
  const result = spawnSync(command, {
    cwd: repoRoot,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, CI: process.env.CI ?? "true" },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
