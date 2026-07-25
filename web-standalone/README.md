# Langfuse Web Standalone

Local, single-process trace viewer and manual evaluator. It does not require
PostgreSQL, ClickHouse, Redis, a worker, authentication, authorization, or
Langfuse API keys.

## Run in development

Requirements: Node.js 24 or later and pnpm.

```bash
cd web-standalone
pnpm install
pnpm dev
```

Open <http://127.0.0.1:3000>. The first run creates `.env`, generates a local
encryption key, applies SQLite migrations, and creates the data directories.

## Run the production build

```bash
pnpm install
pnpm build
pnpm start
```

The production server also binds to `127.0.0.1` by default. Change `PORT` or
`STANDALONE_HOST` in `.env` only when you intentionally need a different
binding. There is no authentication layer, so do not expose it to an untrusted
network.

## Local data

- `data/json/*.json`: read-only traces, observations, and sessions.
- `data/standalone.db`: SQLite state for comments, bookmarks, scores, local
  deletions, dashboards, LLM connections, and evaluator history.
- `data/media/`: uploaded local attachments.

Use [data/json/example.json](data/json/example.json) as the JSON schema example.
Multiple JSON files are merged by ID and indexed in memory. Invalid files are
reported on the overview page without preventing valid files from loading.
After changing JSON files, use **Reload JSON**.

Keep the `ENCRYPTION_KEY` value from `.env`. LLM credentials cannot be
decrypted if that key is lost. Provider calls are the only optional external
network activity and occur only after a connection is configured and a manual
evaluation run is confirmed.

## Verification

```bash
pnpm verify
```

This generates Prisma, checks TypeScript and ESLint, runs the unit tests, and
creates the standalone production build.
