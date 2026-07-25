import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadMockData, resetMockDataCache } from "./loader";
import { resolveMockProcedure } from "./service";

const originalMockDataDir = process.env.MOCK_DATA_DIR;
let tempDirectory: string | undefined;

afterEach(() => {
  resetMockDataCache();
  if (originalMockDataDir === undefined) delete process.env.MOCK_DATA_DIR;
  else process.env.MOCK_DATA_DIR = originalMockDataDir;
  if (tempDirectory) fs.rmSync(tempDirectory, { recursive: true, force: true });
  tempDirectory = undefined;
});

describe("JSON mock data", () => {
  it("merges entity bundles deterministically by id", () => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "web-ui-mock-"));
    fs.writeFileSync(path.join(tempDirectory, "01-traces.json"), JSON.stringify({ traces: [{ id: "trace-1", projectId: "project-1", name: "before" }] }));
    fs.writeFileSync(path.join(tempDirectory, "02-traces.json"), JSON.stringify({ traces: [{ id: "trace-1", projectId: "project-1", name: "after" }, { id: "trace-2", projectId: "project-1" }] }));
    process.env.MOCK_DATA_DIR = tempDirectory;

    expect(loadMockData().traces).toEqual([
      expect.objectContaining({ id: "trace-1", name: "after" }),
      expect.objectContaining({ id: "trace-2" }),
    ]);
  });

  it("filters and sorts list procedures using UI query input", () => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "web-ui-mock-"));
    fs.writeFileSync(path.join(tempDirectory, "traces.json"), JSON.stringify({
      traces: [
        { id: "trace-a", projectId: "project-1", name: "Alpha", environment: "production" },
        { id: "trace-b", projectId: "project-1", name: "Beta", environment: "staging" },
      ],
    }));
    process.env.MOCK_DATA_DIR = tempDirectory;

    const result = resolveMockProcedure("traces.all", {
      projectId: "project-1",
      page: 0,
      limit: 50,
      searchQuery: "beta",
      filter: [{ column: "environment", value: "staging" }],
      orderBy: { column: "name", order: "DESC" },
    });

    expect(result.traces).toHaveLength(1);
    expect(result.traces[0]).toMatchObject({ id: "trace-b", name: "Beta" });
  });

  it("rejects malformed JSON bundles", () => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "web-ui-mock-"));
    fs.writeFileSync(path.join(tempDirectory, "broken.json"), "{not-json");
    process.env.MOCK_DATA_DIR = tempDirectory;

    expect(() => loadMockData()).toThrow();
  });

  it("resolves trace relationships and keeps mutations in memory", () => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "web-ui-mock-"));
    fs.writeFileSync(path.join(tempDirectory, "relations.json"), JSON.stringify({
      traces: [{ id: "trace-1", projectId: "project-1", name: "Related trace" }],
      observations: [{ id: "observation-1", projectId: "project-1", traceId: "trace-1", name: "Root span" }],
      comments: [],
    }));
    process.env.MOCK_DATA_DIR = tempDirectory;

    const trace = resolveMockProcedure("traces.byIdWithObservationsAndScores", {
      projectId: "project-1",
      traceId: "trace-1",
    });
    expect(trace.observations).toEqual([
      expect.objectContaining({ id: "observation-1", traceId: "trace-1" }),
    ]);

    resolveMockProcedure("comments.create", {
      projectId: "project-1",
      objectId: "trace-1",
      content: "Reviewed",
    });
    expect(resolveMockProcedure("comments.getByObjectId", {
      projectId: "project-1",
      objectId: "trace-1",
    })).toEqual([expect.objectContaining({ content: "Reviewed" })]);
  });
});
