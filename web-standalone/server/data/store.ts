import fs from "node:fs";
import path from "node:path";
import { getEnv } from "@/server/env";
import {
  telemetryBundleSchema,
  type ObservationRecord,
  type SessionRecord,
  type TraceRecord,
} from "@/server/data/schemas";

export type TraceFilters = {
  search?: string;
  userId?: string;
  sessionId?: string;
  tags?: string[];
  from?: string;
  to?: string;
};

const matchesTrace = (trace: TraceRecord, filters: TraceFilters) => {
  const normalizedSearch = filters.search?.trim().toLowerCase();
  if (
    normalizedSearch &&
    ![trace.id, trace.name, trace.userId, trace.sessionId]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedSearch))
  ) {
    return false;
  }
  if (filters.userId && trace.userId !== filters.userId) return false;
  if (filters.sessionId && trace.sessionId !== filters.sessionId) return false;
  if (
    filters.tags?.length &&
    !filters.tags.every((tag) => trace.tags.includes(tag))
  ) {
    return false;
  }
  const timestamp = Date.parse(trace.timestamp);
  if (filters.from && timestamp < Date.parse(filters.from)) return false;
  if (filters.to && timestamp > Date.parse(filters.to)) return false;
  return true;
};

export class JsonTelemetryStore {
  private traces = new Map<string, TraceRecord>();
  private observations = new Map<string, ObservationRecord>();
  private observationsByTrace = new Map<string, ObservationRecord[]>();
  private sessions = new Map<string, SessionRecord>();
  private tracesBySession = new Map<string, TraceRecord[]>();
  private errors: string[] = [];
  private loadedAt = new Date(0);

  load(directory = getEnv().JSON_DATA_DIR) {
    const nextTraces = new Map<string, TraceRecord>();
    const nextObservations = new Map<string, ObservationRecord>();
    const nextSessions = new Map<string, SessionRecord>();
    const errors: string[] = [];

    fs.mkdirSync(directory, { recursive: true });
    const files = fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(directory, entry.name))
      .sort();

    for (const file of files) {
      try {
        const bundle = telemetryBundleSchema.parse(
          JSON.parse(fs.readFileSync(file, "utf8")),
        );
        for (const trace of bundle.traces) nextTraces.set(trace.id, trace);
        for (const observation of bundle.observations) {
          nextObservations.set(observation.id, observation);
        }
        for (const session of bundle.sessions) nextSessions.set(session.id, session);
      } catch (error) {
        errors.push(
          `${path.basename(file)}: ${
            error instanceof Error ? error.message : "invalid JSON"
          }`,
        );
      }
    }

    const observationsByTrace = new Map<string, ObservationRecord[]>();
    for (const observation of nextObservations.values()) {
      const current = observationsByTrace.get(observation.traceId) ?? [];
      current.push(observation);
      observationsByTrace.set(observation.traceId, current);
    }
    for (const observations of observationsByTrace.values()) {
      observations.sort(
        (left, right) =>
          Date.parse(left.startTime) - Date.parse(right.startTime),
      );
    }

    const tracesBySession = new Map<string, TraceRecord[]>();
    for (const trace of nextTraces.values()) {
      if (!trace.sessionId) continue;
      const current = tracesBySession.get(trace.sessionId) ?? [];
      current.push(trace);
      tracesBySession.set(trace.sessionId, current);
      if (!nextSessions.has(trace.sessionId)) {
        nextSessions.set(trace.sessionId, {
          id: trace.sessionId,
          createdAt: trace.timestamp,
          userId: trace.userId,
        });
      }
    }

    this.traces = nextTraces;
    this.observations = nextObservations;
    this.observationsByTrace = observationsByTrace;
    this.sessions = nextSessions;
    this.tracesBySession = tracesBySession;
    this.errors = errors;
    this.loadedAt = new Date();
    return this.stats();
  }

  stats() {
    return {
      traces: this.traces.size,
      observations: this.observations.size,
      sessions: this.sessions.size,
      errors: this.errors,
      loadedAt: this.loadedAt,
    };
  }

  getTrace(id: string) {
    return this.traces.get(id) ?? null;
  }

  getObservation(id: string) {
    return this.observations.get(id) ?? null;
  }

  getTraceObservations(traceId: string) {
    return this.observationsByTrace.get(traceId) ?? [];
  }

  listTraces(
    filters: TraceFilters,
    deletedIds = new Set<string>(),
    page = 1,
    limit = 50,
  ) {
    const items = [...this.traces.values()]
      .filter((trace) => !deletedIds.has(trace.id))
      .filter((trace) => matchesTrace(trace, filters))
      .sort(
        (left, right) =>
          Date.parse(right.timestamp) - Date.parse(left.timestamp),
      );
    const start = (page - 1) * limit;
    return {
      items: items.slice(start, start + limit),
      total: items.length,
      page,
      limit,
    };
  }

  allMatchingTraces(filters: TraceFilters, deletedIds = new Set<string>()) {
    return [...this.traces.values()]
      .filter((trace) => !deletedIds.has(trace.id))
      .filter((trace) => matchesTrace(trace, filters));
  }

  listObservations(
    deletedIds = new Set<string>(),
    page = 1,
    limit = 50,
    traceId?: string,
  ) {
    const source = traceId
      ? this.getTraceObservations(traceId)
      : [...this.observations.values()];
    const items = source
      .filter((observation) => !deletedIds.has(observation.id))
      .sort(
        (left, right) =>
          Date.parse(right.startTime) - Date.parse(left.startTime),
      );
    const start = (page - 1) * limit;
    return {
      items: items.slice(start, start + limit),
      total: items.length,
      page,
      limit,
    };
  }

  listSessions(deletedIds = new Set<string>()) {
    return [...this.sessions.values()]
      .filter((session) => !deletedIds.has(session.id))
      .map((session) => ({
        ...session,
        traceCount: this.tracesBySession.get(session.id)?.length ?? 0,
      }))
      .sort(
        (left, right) =>
          Date.parse(right.createdAt ?? "1970-01-01") -
          Date.parse(left.createdAt ?? "1970-01-01"),
      );
  }

  getSession(id: string) {
    const session = this.sessions.get(id);
    if (!session) return null;
    return {
      ...session,
      traces: this.tracesBySession.get(id) ?? [],
    };
  }

  getTargetSnapshot(targetType: string, targetId: string) {
    if (targetType === "TRACE") return this.getTrace(targetId);
    if (targetType === "OBSERVATION") return this.getObservation(targetId);
    if (targetType === "SESSION") return this.getSession(targetId);
    return null;
  }

  dashboardMetrics(deletedTraceIds = new Set<string>()) {
    const traces = [...this.traces.values()].filter(
      (trace) => !deletedTraceIds.has(trace.id),
    );
    const observations = [...this.observations.values()];
    return {
      traceCount: traces.length,
      observationCount: observations.length,
      sessionCount: this.sessions.size,
      totalCost: traces.reduce((sum, trace) => sum + (trace.totalCost ?? 0), 0),
      errorCount: [
        ...traces,
        ...observations,
      ].filter((item) => item.level === "ERROR").length,
      averageLatencyMs:
        traces.length > 0
          ? traces.reduce(
              (sum, trace) => sum + (trace.durationMs ?? 0),
              0,
            ) / traces.length
          : 0,
    };
  }
}

const globalStore = globalThis as unknown as {
  standaloneJsonStore?: JsonTelemetryStore;
};

export const getTelemetryStore = () => {
  if (!globalStore.standaloneJsonStore) {
    globalStore.standaloneJsonStore = new JsonTelemetryStore();
    globalStore.standaloneJsonStore.load();
  }
  return globalStore.standaloneJsonStore;
};
