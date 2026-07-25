import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const standaloneDir = resolve(root, ".next", "standalone");

if (!existsSync(standaloneDir)) {
  throw new Error("Next.js standalone output was not generated.");
}

const copies = [
  [resolve(root, "public"), resolve(standaloneDir, "public")],
  [
    resolve(root, ".next", "static"),
    resolve(standaloneDir, ".next", "static"),
  ],
  [resolve(root, "prisma"), resolve(standaloneDir, "prisma")],
];

for (const [source, destination] of copies) {
  if (!existsSync(source)) continue;
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true, force: true });
}
