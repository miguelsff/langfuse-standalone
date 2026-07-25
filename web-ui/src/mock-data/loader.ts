import fs from "node:fs";
import path from "node:path";
import { mockBundleSchema, mockRecordSchema, type MockDataStore, type MockRecord } from "./types";

const DEFAULT_DATA_DIR = path.join(process.cwd(), "data", "json");

let cached: { key: string; store: MockDataStore } | undefined;

function getDataDirectory() {
  return path.resolve(process.env.MOCK_DATA_DIR || DEFAULT_DATA_DIR);
}

function fileKey(filePath: string) {
  return path.basename(filePath, path.extname(filePath)).replace(/[^a-zA-Z0-9]+(.)/g, (_, letter) => letter.toUpperCase());
}

function addRecord(store: MockDataStore, entity: string, value: unknown, source: string) {
  const record = mockRecordSchema.parse(value) as MockRecord;
  const rows = (store[entity] ??= []);
  const id = record.id;
  if (!id) {
    rows.push({ ...record, id: `${entity}-${rows.length + 1}`, _source: source });
    return;
  }

  const existingIndex = rows.findIndex((row) => row.id === id);
  const next = { ...record, _source: source };
  if (existingIndex === -1) rows.push(next);
  else rows[existingIndex] = next;
}

function mergeJson(store: MockDataStore, value: unknown, source: string) {
  if (Array.isArray(value)) {
    const entity = fileKey(source);
    value.forEach((row) => addRecord(store, entity, row, source));
    return;
  }

  const bundle = mockBundleSchema.parse(value);
  for (const [entity, entityValue] of Object.entries(bundle)) {
    if (Array.isArray(entityValue)) {
      entityValue.forEach((row) => addRecord(store, entity, row, source));
    } else if (entityValue && typeof entityValue === "object") {
      addRecord(store, entity, entityValue, source);
    }
  }
}

function getCacheKey(directory: string, files: string[]) {
  const signature = files
    .map((file) => `${file}:${fs.statSync(file).mtimeMs}`)
    .join("|");
  return `${directory}:${signature}`;
}

export function loadMockData(): MockDataStore {
  const directory = getDataDirectory();
  const files = fs.existsSync(directory)
    ? fs
        .readdirSync(directory)
        .filter((file) => file.toLowerCase().endsWith(".json"))
        .sort()
        .map((file) => path.join(directory, file))
    : [];
  const key = getCacheKey(directory, files);
  if (cached?.key === key) return cached.store;

  const store = { sourceFiles: files } as MockDataStore;
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    mergeJson(store, parsed, file);
  }

  cached = { key, store };
  return store;
}

export function resetMockDataCache() {
  cached = undefined;
}
