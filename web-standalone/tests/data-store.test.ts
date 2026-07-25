import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonTelemetryStore } from "@/server/data/store";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("JsonTelemetryStore", () => {
  it("loads valid telemetry and derives session indexes", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lf-json-"));
    directories.push(directory);
    fs.writeFileSync(
      path.join(directory, "telemetry.json"),
      JSON.stringify({
        version: 1,
        traces: [
          {
            id: "trace-1",
            timestamp: "2026-07-24T00:00:00.000Z",
            sessionId: "session-1",
          },
        ],
        observations: [
          {
            id: "observation-1",
            traceId: "trace-1",
            type: "GENERATION",
            startTime: "2026-07-24T00:00:00.100Z",
          },
        ],
      }),
    );

    const store = new JsonTelemetryStore();
    expect(store.load(directory)).toMatchObject({
      traces: 1,
      observations: 1,
      sessions: 1,
      errors: [],
    });
    expect(store.getTraceObservations("trace-1")).toHaveLength(1);
    expect(store.getSession("session-1")?.traces).toHaveLength(1);
  });

  it("reports invalid files without discarding valid files", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lf-json-"));
    directories.push(directory);
    fs.writeFileSync(path.join(directory, "invalid.json"), "{}");
    fs.writeFileSync(
      path.join(directory, "valid.json"),
      JSON.stringify({ version: 1, traces: [], observations: [] }),
    );

    const store = new JsonTelemetryStore();
    const result = store.load(directory);
    expect(result.errors).toHaveLength(1);
    expect(result.traces).toBe(0);
  });
});
