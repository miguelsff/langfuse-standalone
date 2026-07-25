import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const syncScript = fileURLToPath(
  new URL("./agents/sync-agent-shims.mjs", import.meta.url),
);
const configPath = fileURLToPath(
  new URL("../.agents/config.json", import.meta.url),
);

if (!existsSync(syncScript) || !existsSync(configPath)) {
  console.log(
    "Skipping agent shim sync: scripts/agents/sync-agent-shims.mjs or .agents/config.json is not present in this install context.",
  );
  process.exit(0);
}

for (const args of [[syncScript], [syncScript, "--check"]]) {
  execFileSync(process.execPath, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });
}
