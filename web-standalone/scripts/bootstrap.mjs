import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envPath = resolve(root, ".env");
const dataDir = resolve(root, "data");
const jsonDir = resolve(dataDir, "json");
const mediaDir = resolve(dataDir, "media");

mkdirSync(jsonDir, { recursive: true });
mkdirSync(mediaDir, { recursive: true });

if (!existsSync(envPath)) {
  const encryptionKey = randomBytes(32).toString("hex");
  const contents = [
    'DATABASE_URL="file:../data/standalone.db"',
    'STANDALONE_DATA_DIR="./data/json"',
    'STANDALONE_MEDIA_DIR="./data/media"',
    `ENCRYPTION_KEY="${encryptionKey}"`,
    'STANDALONE_EVAL_CONCURRENCY="2"',
    'STANDALONE_HOST="127.0.0.1"',
    'PORT="3000"',
    "",
  ].join("\n");
  writeFileSync(envPath, contents, { encoding: "utf8", mode: 0o600 });
  process.stdout.write("Created .env with a new encryption key.\n");
} else {
  const contents = readFileSync(envPath, "utf8");
  if (!contents.includes("ENCRYPTION_KEY=")) {
    throw new Error(
      "The existing .env does not define ENCRYPTION_KEY. Copy the value described in .env.example.",
    );
  }
}
