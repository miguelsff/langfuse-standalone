import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const serverPath = resolve(process.cwd(), ".next", "standalone", "server.js");
if (!existsSync(serverPath)) {
  throw new Error("Missing .next/standalone/server.js. Run `pnpm build` first.");
}

const child = spawn(process.execPath, [serverPath], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    STANDALONE_ROOT: process.cwd(),
    HOSTNAME: process.env.STANDALONE_HOST ?? "127.0.0.1",
    PORT: process.env.PORT ?? "3000",
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
