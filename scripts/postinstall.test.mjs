import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const isWindows = process.platform === "win32";

test("root postinstall runs in the native Node environment", () => {
  const result = spawnSync(
    isWindows ? process.env.ComSpec ?? "cmd.exe" : "pnpm",
    isWindows
      ? ["/d", "/s", "/c", "pnpm run postinstall"]
      : ["run", "postinstall"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr, result.error?.stack]
      .filter(Boolean)
      .join("\n"),
  );
});
