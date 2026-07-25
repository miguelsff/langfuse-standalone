import { loadMockData } from "./loader";
import type { MockDataStore, MockRecord } from "./types";

const first = <T extends MockRecord>(rows: T[], id?: unknown) =>
  rows.find((row) => id && row.id === id) ?? rows[0] ?? null;

const inputValue = (input: any, ...keys: string[]) => {
  for (const key of keys) if (input?.[key] !== undefined) return input[key];
  return undefined;
};

const projectIdFrom = (input: any, store: MockDataStore) =>
  inputValue(input, "projectId") ?? store.projects?.[0]?.id ?? "project-demo";

function byProject(rows: MockRecord[], projectId: unknown) {
  return rows.filter((row) => !row.projectId || row.projectId === projectId);
}

function valueAt(row: MockRecord, path: string) {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, row);
}

function matchesFilter(row: MockRecord, filter: unknown) {
  if (!Array.isArray(filter)) return true;
  return filter.every((entry) => {
    if (!entry || typeof entry !== "object") return true;
    const candidate = entry as Record<string, unknown>;
    const column = String(candidate.column ?? candidate.field ?? candidate.id ?? "");
    const actual = valueAt(row, column);
    const rawExpected = candidate.value ?? candidate.values;
    if (!column || rawExpected === undefined || rawExpected === null || rawExpected === "") return true;
    // Unknown fields belong to richer backend-only filters (time ranges,
    // nested metadata, and computed metrics). The mock cannot evaluate those,
    // so they must not hide otherwise valid fixture rows.
    if (valueAt(row, column) === undefined) return true;
    const expectedValues = Array.isArray(rawExpected) ? rawExpected : [rawExpected];
    const actualText = String(actual ?? "").toLowerCase();
    const operator = String(candidate.operator ?? candidate.type ?? "").toLowerCase();
    if (["none of", "not in", "notin"].includes(operator)) {
      return !expectedValues.some((expected) => actualText === String(expected).toLowerCase());
    }
    if ([">=", "gte", "after_or_equal"].includes(operator)) {
      return String(actual ?? "") >= String(expectedValues[0] ?? "");
    }
    if (["<=", "lte", "before_or_equal"].includes(operator)) {
      return String(actual ?? "") <= String(expectedValues[0] ?? "");
    }
    if ([">", "gt"].includes(operator)) return String(actual ?? "") > String(expectedValues[0] ?? "");
    if (["<", "lt"].includes(operator)) return String(actual ?? "") < String(expectedValues[0] ?? "");
    return expectedValues.some((expected) => {
      const expectedText = String(expected).toLowerCase();
      if (["neq", "!=", "not_equals"].includes(operator)) return actualText !== expectedText;
      if (["contains", "like", "includes"].includes(operator)) return actualText.includes(expectedText);
      if (["starts_with", "startswith"].includes(operator)) return actualText.startsWith(expectedText);
      return actualText === expectedText;
    });
  });
}

function applyListControls(rows: MockRecord[], input: any) {
  const search = String(input?.searchQuery ?? input?.search ?? input?.query ?? "").trim().toLowerCase();
  const searched = search
    ? rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(search)))
    : rows;
  const filtered = searched.filter((row) => matchesFilter(row, input?.filter));
  const orderBy = input?.orderBy;
  if (!orderBy || typeof orderBy !== "object") return filtered;
  const column = String(orderBy.column ?? orderBy.id ?? "");
  if (!column) return filtered;
  const direction = String(orderBy.order ?? orderBy.direction ?? "ASC").toUpperCase() === "DESC" ? -1 : 1;
  return [...filtered].sort((left, right) => {
    const a = String(valueAt(left, column) ?? "");
    const b = String(valueAt(right, column) ?? "");
    return a.localeCompare(b, undefined, { numeric: true }) * direction;
  });
}

function paginated(rows: MockRecord[], input: any) {
  const limit = Number(input?.limit ?? input?.pageSize ?? 50);
  const page = Number(input?.page ?? 1);
  const cursor = Number(input?.cursor ?? 0);
  const start = Number.isFinite(cursor) && cursor > 0 ? cursor : page <= 0 ? 0 : (page - 1) * limit;
  const data = rows.slice(start, start + limit);
  return {
    data,
    items: data,
    rows: data,
    totalCount: rows.length,
    totalItems: rows.length,
    meta: {
      totalItems: rows.length,
      page,
      limit,
      nextPage: start + limit < rows.length ? start + limit : undefined,
      hasMore: start + limit < rows.length,
    },
  };
}

function dashboardFor(store: MockDataStore, dashboardId?: string) {
  const dashboards = store.dashboards ?? [];
  const dashboard = first(dashboards, dashboardId);
  if (dashboard) {
    const definition = dashboard.definition && typeof dashboard.definition === "object"
      ? dashboard.definition
      : {};
    const widgets = Array.isArray((definition as any).widgets)
      ? (definition as any).widgets
      : (store.widgets ?? [])
          .filter((widget) => !widget.dashboardId || widget.dashboardId === dashboard.id)
          .map((widget, index) => ({
            id: `placement-${widget.id}`,
            widgetId: widget.id,
            x: (index % 3) * 4,
            y: Math.floor(index / 3) * 4,
            x_size: 4,
            y_size: 4,
            type: "widget",
          }));
    return { ...dashboard, definition: { ...definition, widgets } };
  }
  return {
    id: dashboardId ?? "dashboard-home",
    projectId: store.projects?.[0]?.id ?? "project-demo",
    name: "Langfuse Home",
    owner: "LANGFUSE",
    definition: { tabs: [{ name: "Overview", widgets: [] }] },
  };
}

function resolveList(store: MockDataStore, resource: string, input: any) {
  const aliases: Record<string, string[]> = {
    traces: ["traces"],
    observations: ["observations", "generations"],
    generations: ["observations", "generations"],
    sessions: ["sessions"],
    scores: ["scores"],
    users: ["users"],
    projects: ["projects"],
    organizations: ["organizations"],
    datasets: ["datasets"],
    prompts: ["prompts", "promptMeta"],
    evaluators: ["evaluators", "evaluationConfigs"],
    dashboards: ["dashboards"],
    widgets: ["widgets"],
    monitors: ["monitors"],
    models: ["models"],
    comments: ["comments"],
    annotationQueues: ["annotationQueues"],
    annotationQueueItems: ["annotationQueueItems"],
    datasetItems: ["datasetItems"],
    datasetRuns: ["datasetRuns"],
    experiments: ["experiments"],
  };
  const rows = (aliases[resource] ?? [resource]).flatMap((key) => store[key] ?? []);
  let scopedRows = byProject(rows, inputValue(input, "projectId"));
  const datasetId = inputValue(input, "datasetId");
  const queueId = inputValue(input, "queueId");
  if (datasetId && ["datasetItems", "datasetRuns", "experiments"].includes(resource)) {
    scopedRows = scopedRows.filter((row) => row.datasetId === datasetId);
  }
  if (queueId && resource === "annotationQueueItems") {
    scopedRows = scopedRows.filter((row) => row.queueId === queueId);
  }
  return paginated(applyListControls(scopedRows, input), input);
}

function resolveMutation(store: MockDataStore, resource: string, operation: string, input: any) {
  const entity = resource === "prompt" ? "prompts" : resource;
  const rows = (store[entity] ??= []);
  const id = inputValue(input, "id", `${resource}Id`, "projectId") ?? `${resource}-mock-${rows.length + 1}`;
  const record = { ...(input && typeof input === "object" ? input : {}), id };
  const index = rows.findIndex((row) => row.id === id);
  if (operation === "delete" || operation === "remove") {
    if (index >= 0) rows.splice(index, 1);
    return { id, success: true };
  }
  if (index >= 0) rows[index] = { ...rows[index], ...record };
  else rows.push(record);
  return { ...record, success: true, operation };
}

function normalizeModel(model: MockRecord, projectId: string) {
  const inputPrice = Number(model.inputPrice ?? 0);
  const outputPrice = Number(model.outputPrice ?? 0);
  return {
    id: model.id ?? `model-${model.modelName ?? "demo"}`,
    projectId: model.projectId ?? projectId,
    modelName: model.modelName ?? "mock-model",
    matchPattern: model.matchPattern ?? `(?i)^(${model.modelName ?? "mock-model"})$`,
    tokenizerId: model.tokenizerId ?? null,
    tokenizerConfig: model.tokenizerConfig ?? {},
    pricingTiers: Array.isArray(model.pricingTiers) && model.pricingTiers.length > 0
      ? model.pricingTiers
      : [{
          id: `${model.id ?? "model-demo"}-default-tier`,
          name: "Default",
          isDefault: true,
          priority: 0,
          conditions: [],
          prices: { input: inputPrice, output: outputPrice },
        }],
  };
}

export function resolveMockProcedure(path: string, input: any = {}) {
  const store = loadMockData();
  const segments = path.split(".");
  const resource = segments[0] ?? "";
  const operation = segments.slice(1).join(".");
  const projectId = projectIdFrom(input, store);

  if (resource === "uiCustomization" && operation === "get") {
    return null;
  }
  if (resource === "monitors" && operation === "hasAny") {
    return byProject(store.monitors ?? [], projectId).length > 0;
  }
  if (resource === "monitors" && operation === "all") {
    const result = resolveList(store, "monitors", input);
    return { ...result, monitors: result.data };
  }
  if (resource === "backgroundMigrations" && operation === "status") {
    return { status: "FINISHED" };
  }
  if (resource === "public" && operation === "checkUpdate") {
    return { updateType: null, latestRelease: null };
  }
  if (resource === "projects" && operation === "environmentFilterOptions") {
    return Array.from(new Set(byProject(store.traces ?? [], projectId)
      .map((row) => ({ environment: row.environment }))
      .filter((row) => Boolean(row.environment))
      .map((row) => row.environment)))
      .map((environment) => ({ environment }));
  }
  if (resource.toLowerCase() === "tableviewpresets") {
    if (operation === "getByTableName") {
      return [
        {
          id: "preset-production",
          name: "Production",
          category: "SYSTEM",
          isSystem: true,
          projectId,
          filters: [],
          searchQuery: "",
          orderBy: null,
          columnOrder: [],
          columnVisibility: {},
        },
        {
          id: "preset-my-view",
          name: "My view",
          category: "USER",
          isSystem: false,
          projectId,
          filters: [],
          searchQuery: "",
          orderBy: null,
          columnOrder: [],
          columnVisibility: {},
        },
      ];
    }
    if (operation === "getDefaultAssignments") {
      return { userDefaultViewId: null, projectDefaultViewId: null };
    }
    if (operation === "getDefault") return null;
  }

  if (
    (operation === "byId" || operation === "getById" || operation === "itemById" || operation === "runById") &&
    !(resource === "users" && operation === "byId") &&
    !(resource === "annotationQueues" && operation === "byId")
  ) {
    const id = inputValue(input, "id", `${resource}Id`, "traceId", "observationId", "datasetId", "itemId", "runId");
    const rows = store[resource] ?? store[resource.replace(/s$/, "")] ?? [];
    const value = first(rows, id) ?? { id, projectId, name: `${resource} ${id ?? "demo"}` };
    const normalizedValue = resource === "models" ? normalizeModel(value, projectId) : value;
    return resource === "projects" ? { project: normalizedValue, organization: first(store.organizations) } : normalizedValue;
  }

  if (resource === "users" && (operation === "byId" || operation === "byIdFromEvents")) {
    const user = first(store.users ?? [], inputValue(input, "userId", "id"));
    const userTraces = (store.traces ?? []).filter((trace) => trace.userId === user?.id);
    return {
      ...user,
      totalObservations: (store.observations ?? []).filter((row) => userTraces.some((trace) => trace.id === row.traceId)).length,
      totalTraces: userTraces.length,
      totalTokens: userTraces.reduce((total, trace) => total + Number(trace.totalTokens ?? 0), 0),
      sumCalculatedTotalCost: userTraces.reduce((total, trace) => total + Number(trace.totalCost ?? 0), 0),
      firstTrace: userTraces.map((trace) => trace.timestamp).sort()[0],
      lastTrace: userTraces.map((trace) => trace.timestamp).sort().at(-1),
    };
  }

  if (resource === "evals" && operation === "configById") {
    const config = first(store.evaluators ?? [], inputValue(input, "id", "evaluatorId"));
    return {
      ...(config ?? {}),
      id: config?.id ?? inputValue(input, "id", "evaluatorId"),
      projectId: config?.projectId ?? projectId,
      scoreName: config?.scoreName ?? config?.name ?? "quality",
      status: config?.status ?? "ACTIVE",
      displayStatus: config?.displayStatus ?? config?.status ?? "ACTIVE",
      targetObject: config?.targetObject ?? "trace",
      filter: config?.filter ?? [],
      timeScope: config?.timeScope ?? [],
      createdAt: config?.createdAt ?? "2026-07-01T00:00:00.000Z",
      updatedAt: config?.updatedAt ?? "2026-07-20T00:00:00.000Z",
      evalTemplate: config?.evalTemplate ?? {
        id: config?.templateId ?? "eval-template-quality",
        name: config?.name ?? "Quality rubric",
        version: config?.version ?? 1,
        projectId: config?.projectId ?? projectId,
      },
    };
  }

  if (resource === "annotationQueues" && operation === "byId") {
    const queue = first(store.annotationQueues ?? [], inputValue(input, "queueId", "id"));
    return {
      ...queue,
      scoreConfigs: (store.scoreConfigs ?? []).map((config) => ({
        ...config,
        dataType: config.dataType ?? "NUMERIC",
      })),
      items: (store.annotationQueueItems ?? []).filter((item) => item.queueId === queue?.id),
    };
  }

  if (resource === "projects" && operation === "byId") {
    const project = first(store.projects, inputValue(input, "projectId"));
    return { project, organization: first(store.organizations) };
  }

  if (resource === "organizations" && operation === "lastTraceByProject") {
    return byProject(store.traces ?? [], projectId).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0] ?? null;
  }

  if (resource === "dashboard") {
    if (operation === "getHomeDashboard") {
      const dashboard = dashboardFor(store);
      return { homeDashboardId: dashboard.id, dashboard };
    }
    if (operation === "getDashboard") return dashboardFor(store, inputValue(input, "dashboardId"));
    if (operation === "allDashboards") {
      const result = resolveList(store, "dashboards", input);
      return { ...result, dashboards: result.data, totalDashboards: result.totalCount };
    }
    if (operation === "executeQuery" || operation === "chart" || operation === "query") {
      return [
        { count_count: (store.traces ?? []).length, time_dimension: "2026-07-24T00:00:00.000Z" },
        { count_count: Math.max(1, Math.floor((store.traces ?? []).length / 2)), time_dimension: "2026-07-23T00:00:00.000Z" },
      ];
    }
  }

  if (resource === "dashboardWidgets") {
    const widgetId = inputValue(input, "widgetId", "id");
    const storedWidget = first(store.widgets ?? [], widgetId);
    const widget = {
      ...(storedWidget ?? { id: widgetId ?? "widget-demo", name: "Trace volume" }),
      id: storedWidget?.id ?? widgetId ?? "widget-demo",
      projectId,
      owner: storedWidget?.owner ?? "PROJECT",
      view: storedWidget?.view ?? "traces",
      dimensions: storedWidget?.dimensions ?? [],
      metrics: storedWidget?.metrics ?? [{ measure: "count", agg: "count" }],
      filters: storedWidget?.filters ?? [],
      chartType: storedWidget?.chartType ?? "NUMBER",
      chartConfig: storedWidget?.chartConfig ?? { type: "NUMBER" },
      minVersion: storedWidget?.minVersion ?? 1,
    };
    if (operation === "get") return widget;
    if (operation === "all") {
      const widgets = (store.widgets ?? []).map((entry) => ({
        ...entry,
        view: entry.view ?? "traces",
        chartType: entry.chartType ?? (
          entry.type === "LINE_CHART" ? "LINE_TIME_SERIES" :
          entry.type === "BAR_CHART" ? "BAR_TIME_SERIES" :
          entry.type === "PIE_CHART" ? "PIE" : "NUMBER"
        ),
        description: entry.description ?? "Mock dashboard widget",
        createdAt: entry.createdAt ?? "2026-07-01T00:00:00.000Z",
        updatedAt: entry.updatedAt ?? "2026-07-20T00:00:00.000Z",
      }));
      return { widgets, totalCount: widgets.length };
    }
  }

  if (resource === "sessions" && (operation === "filterOptions" || operation === "filterOptionsFromEvents")) {
    return { userIds: [], tags: [], score_categories: [], scores_avg: [], score_booleans: [] };
  }
  if (resource === "sessions" && (operation === "metrics" || operation === "metricsFromEvents")) return [];
  if (resource === "sessions" && (operation === "countAll" || operation === "countAllFromEvents")) {
    return { totalCount: (store.sessions ?? []).length };
  }
  if (resource === "users" && (operation === "metrics" || operation === "metricsFromEvents")) return [];
  if (resource === "scores" && (operation === "metrics" || operation === "metricsFromEvents")) return [];
  if (resource === "scores" && (operation === "filterOptions" || operation === "filterOptionsFromEvents")) {
    return { name: [], source: [], dataType: [], traceName: [], userId: [], tags: [], environment: [], score_categories: [], scores_avg: [], score_booleans: [] };
  }
  if (resource === "scores" && (operation === "countAll" || operation === "countAllFromEvents")) {
    return { totalCount: (store.scores ?? []).length };
  }

  if (resource === "prompts") {
    if (operation === "hasAny") return byProject(store.prompts ?? [], projectId).length > 0;
    if (operation === "count") return { totalCount: byProject(store.prompts ?? [], projectId).length };
    if (operation === "all") {
      const result = resolveList(store, "prompts", input);
      const prompts = result.data.map((prompt) => ({
        ...prompt,
        fullPath: prompt.name,
        version: prompt.latestVersion ?? prompt.version ?? 1,
        createdAt: prompt.createdAt ?? "2026-07-01T00:00:00.000Z",
        labels: prompt.labels ?? [],
        tags: prompt.tags ?? [],
        observationCount: prompt.observationCount ?? 0,
        row_type: prompt.row_type ?? "prompt",
      }));
      return { ...result, prompts, totalCount: prompts.length };
    }
    if (operation === "metrics") return [];
    if (operation === "filterOptions") {
      return {
        type: ["text", "chat"],
        labels: [{ value: "production", count: 1 }, { value: "staging", count: 1 }],
        tags: [],
      };
    }
    if (operation === "allNames") return byProject(store.prompts ?? [], projectId).map((prompt) => ({ value: prompt.name }));
      if (operation === "allLabels") {
        return Array.from(
          new Set(
            byProject(store.prompts ?? [], projectId).flatMap((prompt) =>
              Array.isArray(prompt.labels) ? prompt.labels : [],
            ),
          ),
        );
      }
    if (operation === "allVersions") {
      const prompt = first(store.prompts ?? [], inputValue(input, "promptName", "name"));
      const versions = (store.promptVersions ?? []).filter((version) => version.promptId === prompt?.id);
      return {
        promptVersions: versions.map((version) => ({
          ...version,
          name: prompt?.name,
          type: prompt?.type ?? "text",
          labels: version.labels ?? prompt?.labels ?? [],
          tags: version.tags ?? prompt?.tags ?? [],
          prompt: version.prompt ?? "You are a precise support assistant.",
        })),
        versions,
        commentCounts: {},
        totalCount: versions.length,
      };
    }
  }

  if (resource === "evals") {
    if (operation === "counts") {
      return {
        configCount: byProject(store.evaluators ?? [], projectId).length,
        templateCount: byProject(store.evaluationConfigs ?? [], projectId).length,
      };
    }
    if (operation === "jobConfigsByTarget") {
      const result = resolveList(store, "evaluators", input);
      return result.data.map((config) => ({
        ...config,
        filter: config.filter ?? [],
        status: config.status ?? "ACTIVE",
        displayStatus: config.displayStatus ?? config.status ?? "ACTIVE",
        targetObject: config.targetObject ?? "dataset",
      }));
    }
    if (operation === "allConfigs") {
      const result = resolveList(store, "evaluators", input);
      const configs = result.data.map((config) => ({
        ...config,
        createdAt: config.createdAt ?? "2026-07-01T00:00:00.000Z",
        updatedAt: config.updatedAt ?? "2026-07-20T00:00:00.000Z",
        displayStatus: config.displayStatus ?? config.status ?? "ACTIVE",
        targetObject: config.targetObject ?? "trace",
        filter: config.filter ?? [],
        timeScope: config.timeScope ?? [],
        evalTemplate: config.evalTemplate ?? {
          id: config.templateId ?? "eval-template-quality",
          name: config.name ?? "Quality rubric",
          version: config.version ?? 1,
          projectId: config.projectId ?? projectId,
        },
      }));
      return { ...result, configs, evaluators: configs };
    }
    if (["allTemplates", "allTemplatesForName", "latestTemplates", "templateNames"].includes(operation)) {
      const result = resolveList(store, "evaluationConfigs", input);
      const templates = result.data.map((template: MockRecord) => ({
        ...template,
        name: template.name ?? "Mock evaluator",
        version: template.version ?? 1,
        type: template.type ?? "NUMERIC",
        scoreType: template.scoreType ?? "NUMERIC",
        createdAt: template.createdAt ?? "2026-07-01T00:00:00.000Z",
      }));
      return operation === "templateNames"
        ? templates.map((template) => ({ name: template.name, count: 1 }))
        : { ...result, templates, data: templates, totalCount: templates.length };
    }
    if (operation === "codeEvalCapabilities") return { enabled: false };
    if (operation === "globalJobConfigs") return { enabled: true };
    if (operation === "costByEvaluatorIds") return {};
    if (operation === "jobExecutionCountsByEvaluatorIds") return {};
  }

  if (resource === "datasets" && operation === "allDatasets") {
    const result = resolveList(store, "datasets", input);
    return { ...result, datasets: result.data, totalDatasets: result.totalCount };
  }
  if (resource === "datasets" && operation === "allDatasetsMetrics") return { metrics: [] };
  if (resource === "datasets" && operation === "allDatasetMeta") {
    return byProject(store.datasets ?? [], projectId);
  }
  if (resource === "datasets" && operation === "itemsByDatasetId") {
    const items = byProject(store.datasetItems ?? [], projectId).filter(
      (item) => !inputValue(input, "datasetId") || item.datasetId === inputValue(input, "datasetId"),
    );
    return {
      ...paginated(items, input),
      items,
      datasetItems: items,
      totalDatasetItems: items.length,
    };
  }
  if (resource === "datasets" && operation === "runsByDatasetId") {
    const runs = byProject(store.datasetRuns ?? [], projectId).filter(
      (run) => !inputValue(input, "datasetId") || run.datasetId === inputValue(input, "datasetId"),
    );
    return { ...paginated(runs, input), runs };
  }
  if (resource === "datasets" && operation === "runsByDatasetIdMetrics") return { runs: [] };
  if (resource === "datasets" && operation === "runFilterOptions") return {};
  if (resource === "models" && operation === "getAll") {
    const result = resolveList(store, "models", input);
    const models = result.data.map((model) => normalizeModel(model, projectId));
    return { ...result, data: models, items: models, rows: models, models };
  }
  if (resource === "annotationQueues" && operation === "allNamesAndIds") {
    return (store.annotationQueues ?? []).map((queue) => ({ id: queue.id, name: queue.name }));
  }

  if (resource === "widgets" && (operation === "all" || operation === "getAll")) {
    const widgets = (store.widgets ?? []).map((widget) => ({
      ...widget,
      view: widget.view ?? "traces",
      chartType: widget.chartType ?? (
        widget.type === "LINE_CHART" ? "LINE_TIME_SERIES" :
        widget.type === "BAR_CHART" ? "BAR_TIME_SERIES" :
        widget.type === "PIE_CHART" ? "PIE" : "NUMBER"
      ),
      description: widget.description ?? "Mock dashboard widget",
      createdAt: widget.createdAt ?? "2026-07-01T00:00:00.000Z",
      updatedAt: widget.updatedAt ?? "2026-07-20T00:00:00.000Z",
    }));
    return { widgets, data: widgets, totalCount: widgets.length };
  }

  if (resource === "annotationQueues" && operation === "byObjectId") {
    const queues = (store.annotationQueues ?? []).map((queue) => ({
      ...queue,
      itemId: (store.annotationQueueItems ?? []).find(
        (item) => item.queueId === queue.id && item.objectId === inputValue(input, "objectId"),
      )?.id,
    }));
    return { queues, totalCount: queues.length };
  }
  if (resource === "comments" && (operation === "getByObjectId" || operation === "listForComment")) {
    return (store.comments ?? []).filter((comment) =>
      !inputValue(input, "objectId") || comment.objectId === inputValue(input, "objectId"),
    );
  }
  if (resource === "media" && operation === "getByTraceOrObservationId") return [];
  if (resource === "media" && operation === "getById") return null;
  if ((resource === "traces" || resource === "events") && operation === "getAgentGraphData") return [];

  if (resource === "traces" && operation === "hasTracingConfigured") return true;
  if (resource === "traces" && operation.includes("byIdWith")) {
    const trace = first(store.traces ?? [], inputValue(input, "traceId", "id"));
    const traceId = trace?.id ?? inputValue(input, "traceId", "id");
    return {
      ...trace,
      id: traceId,
      projectId: trace?.projectId ?? projectId,
      metadata: trace?.metadata ?? {},
      bookmarked: trace?.bookmarked ?? false,
      public: trace?.public ?? false,
      observations: (store.observations ?? []).filter((row) => row.traceId === traceId),
      scores: (store.scores ?? []).filter((row) => row.traceId === traceId),
      corrections: (store.corrections ?? []).filter((row) => row.traceId === traceId),
    };
  }
  if (resource === "observations" && operation.includes("ForTrace")) {
    return byProject(store.observations ?? [], projectId).filter((row) => !input?.traceId || row.traceId === input.traceId);
  }
  if (resource === "sessions" && operation.startsWith("byId")) {
    const session = first(store.sessions ?? [], inputValue(input, "sessionId", "id"));
    return { ...session, traces: (store.traces ?? []).filter((row) => row.sessionId === session?.id), scores: store.scores ?? [] };
  }
  if (resource === "traces" && operation === "metrics") return [];
  if (resource === "traces" && operation === "countAll") {
    return { totalCount: byProject(store.traces ?? [], projectId).length };
  }
  if (resource === "public" && operation === "tracingSearchConfig") {
    return { legacyTracingIoSearchEnabled: true };
  }
  if (resource === "environment" || operation.toLowerCase().includes("environment")) {
    return { environment: [...new Set(byProject(store.traces ?? [], projectId).map((row) => row.environment).filter(Boolean))] };
  }
  if (resource === "filterOptions" || operation.toLowerCase().includes("filteroptions")) {
    return { environment: [], name: [], tags: [], traceTags: [], type: [], level: [], providedModelName: [], modelId: [], promptName: [] };
  }
  if (["create", "update", "upsert", "delete", "remove", "save", "publish", "set", "add", "clone", "duplicate", "clear", "cancel", "complete", "archive", "reactivate", "run", "trigger", "mark", "submit"].some((verb) => operation.toLowerCase().startsWith(verb))) {
    return resolveMutation(store, resource, operation, input);
  }

  const listResource = resource === "scoreConfigs" ? "scores" : resource;
  if (operation === "count" || operation === "countAll" || operation.startsWith("count")) {
    const result = resolveList(store, listResource, input);
    return result.totalCount;
  }
  if (operation === "metrics" || operation.includes("Metrics") || operation.includes("TimeSeries") || operation.includes("Histogram") || operation === "analytics") {
    return { data: [], rows: [], series: [], total: 0, count: 0 };
  }
  if (operation === "all" || operation.startsWith("all") || operation.startsWith("list") || operation.startsWith("items") || operation.startsWith("runs") || operation.startsWith("scores") || operation.startsWith("getAll") || operation.startsWith("latest") || operation.startsWith("templates") || operation.startsWith("versions") || operation.startsWith("names") || operation.startsWith("by")) {
    const result = resolveList(store, listResource, input);
    if (listResource === "traces") {
      const traces = result.data.map((trace) => ({
        ...trace,
        scores: (store.scores ?? []).filter((score) => score.traceId === trace.id),
      }));
      return { ...result, data: traces, items: traces, rows: traces, traces };
    }
    if (listResource === "sessions") return { ...result, sessions: result.data };
    if (listResource === "users") return { ...result, users: result.data };
    if (listResource === "scores") {
      const scores = result.data.map((score) => {
        const trace = first(store.traces ?? [], score.traceId);
        return {
          ...score,
          traceName: score.traceName ?? trace?.name,
          traceUserId: score.traceUserId ?? trace?.userId,
          traceTags: score.traceTags ?? trace?.tags ?? [],
        };
      });
      return { ...result, data: scores, items: scores, rows: scores, scores };
    }
    if (listResource === "observations" || listResource === "generations") return { ...result, observations: result.data, generations: result.data };
    return result;
  }

  const generic = resolveList(store, listResource, input);
  return {
    ...generic,
    id: inputValue(input, "id"),
    projectId,
    result: generic.data,
  };
}
