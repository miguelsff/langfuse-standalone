import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getTelemetryStore } from "@/server/data/store";
import {
  enqueueEvaluation,
  previewEvaluationScope,
} from "@/server/evaluations/service";
import { assertSafeOutboundUrl } from "@/server/security/outbound-url";
import { publicProcedure, router } from "@/server/trpc";

const targetTypeSchema = z.enum(["TRACE", "OBSERVATION", "SESSION"]);
const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(200).default(50),
});
const targetSchema = z.object({
  targetType: targetTypeSchema,
  targetId: z.string().min(1),
});

const ensureTarget = (targetType: string, targetId: string) => {
  const target = getTelemetryStore().getTargetSnapshot(targetType, targetId);
  if (!target) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Target not found" });
  }
  return target;
};

const systemRouter = router({
  status: publicProcedure.query(async ({ ctx }) => {
    const [database, json] = await Promise.all([
      ctx.database.$queryRawUnsafe<Array<{ journal_mode: string }>>(
        "PRAGMA journal_mode",
      ),
      Promise.resolve(getTelemetryStore().stats()),
    ]);
    return {
      mode: "standalone" as const,
      projectId: ctx.projectId,
      userId: ctx.userId,
      authentication: false,
      database: database[0]?.journal_mode ?? "sqlite",
      json,
    };
  }),
  reloadJson: publicProcedure.mutation(() => getTelemetryStore().load()),
});

const traceFiltersSchema = z.object({
  search: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const tracesRouter = router({
  list: publicProcedure
    .input(
      paginationSchema.extend({
        filters: traceFiltersSchema.default({}),
      }),
    )
    .query(async ({ ctx, input }) => {
      const deleted = await ctx.state.deletedIds("TRACE");
      return getTelemetryStore().listTraces(
        input.filters,
        deleted,
        input.page,
        input.limit,
      );
    }),
  detail: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const trace = getTelemetryStore().getTrace(input.id);
      if (!trace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trace not found" });
      }
      const [annotations, deletedObservations] = await Promise.all([
        ctx.state.annotations("TRACE", input.id),
        ctx.state.deletedIds("OBSERVATION"),
      ]);
      return {
        trace,
        observations: getTelemetryStore()
          .getTraceObservations(input.id)
          .filter((item) => !deletedObservations.has(item.id)),
        annotations,
      };
    }),
});

const observationsRouter = router({
  list: publicProcedure
    .input(paginationSchema.extend({ traceId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const deleted = await ctx.state.deletedIds("OBSERVATION");
      return getTelemetryStore().listObservations(
        deleted,
        input.page,
        input.limit,
        input.traceId,
      );
    }),
  detail: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const observation = getTelemetryStore().getObservation(input.id);
      if (!observation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Observation not found",
        });
      }
      return {
        observation,
        trace: getTelemetryStore().getTrace(observation.traceId),
        annotations: await ctx.state.annotations("OBSERVATION", input.id),
      };
    }),
});

const sessionsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const deleted = await ctx.state.deletedIds("SESSION");
    return getTelemetryStore().listSessions(deleted);
  }),
  detail: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const session = getTelemetryStore().getSession(input.id);
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      return {
        session,
        annotations: await ctx.state.annotations("SESSION", input.id),
      };
    }),
});

const annotationsRouter = router({
  get: publicProcedure.input(targetSchema).query(({ ctx, input }) => {
    ensureTarget(input.targetType, input.targetId);
    return ctx.state.annotations(input.targetType, input.targetId);
  }),
  toggleBookmark: publicProcedure
    .input(targetSchema)
    .mutation(({ ctx, input }) => {
      ensureTarget(input.targetType, input.targetId);
      return ctx.state.toggleBookmark(input.targetType, input.targetId);
    }),
  setDeleted: publicProcedure
    .input(targetSchema.extend({ deleted: z.boolean() }))
    .mutation(({ ctx, input }) => {
      ensureTarget(input.targetType, input.targetId);
      return ctx.state.setDeleted(
        input.targetType,
        input.targetId,
        input.deleted,
      );
    }),
  createComment: publicProcedure
    .input(targetSchema.extend({ content: z.string().trim().min(1).max(10_000) }))
    .mutation(({ ctx, input }) => {
      ensureTarget(input.targetType, input.targetId);
      return ctx.state.createComment(
        input.targetType,
        input.targetId,
        input.content,
      );
    }),
  updateComment: publicProcedure
    .input(z.object({ id: z.string(), content: z.string().trim().min(1).max(10_000) }))
    .mutation(({ ctx, input }) =>
      ctx.state.updateComment(input.id, input.content),
    ),
  deleteComment: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.state.deleteComment(input.id)),
  createScore: publicProcedure
    .input(
      targetSchema.extend({
        name: z.string().trim().min(1).max(200),
        dataType: z.enum(["NUMERIC", "BOOLEAN", "CATEGORICAL"]),
        value: z.number().optional(),
        stringValue: z.string().max(1_000).optional(),
        comment: z.string().max(10_000).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      ensureTarget(input.targetType, input.targetId);
      return ctx.state.createScore(input);
    }),
  deleteScore: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.state.deleteScore(input.id)),
  listScores: publicProcedure.query(({ ctx }) => ctx.state.listScores()),
});

const dashboardsRouter = router({
  list: publicProcedure.query(({ ctx }) => ctx.state.listDashboards()),
  metrics: publicProcedure.query(async ({ ctx }) => {
    const deleted = await ctx.state.deletedIds("TRACE");
    return getTelemetryStore().dashboardMetrics(deleted);
  }),
  create: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        description: z.string().max(2_000).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.state.createDashboard(input.name, input.description),
    ),
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.state.deleteDashboard(input.id)),
  addWidget: publicProcedure
    .input(
      z.object({
        dashboardId: z.string(),
        title: z.string().trim().min(1).max(200),
        metric: z.enum([
          "traceCount",
          "observationCount",
          "sessionCount",
          "totalCost",
          "errorCount",
          "averageLatencyMs",
        ]),
        chartType: z.enum(["NUMBER", "BAR"]).default("NUMBER"),
      }),
    )
    .mutation(({ ctx, input }) => ctx.state.addWidget(input)),
  deleteWidget: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.state.deleteWidget(input.id)),
});

const connectionsRouter = router({
  list: publicProcedure.query(({ ctx }) => ctx.state.listConnections()),
  create: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        provider: z.string().trim().min(1).max(200),
        adapter: z.enum([
          "OPENAI",
          "OPENAI_COMPATIBLE",
          "ANTHROPIC",
          "AZURE_OPENAI",
          "GOOGLE_AI",
          "AMAZON_BEDROCK",
          "GOOGLE_VERTEX",
        ]),
        apiKey: z.string().min(1).max(20_000),
        baseUrl: z.string().url().nullable().optional(),
        headers: z.record(z.string(), z.string()).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.baseUrl) await assertSafeOutboundUrl(input.baseUrl);
      return ctx.state.createConnection(input);
    }),
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).max(200).optional(),
        apiKey: z.string().min(1).max(20_000).optional(),
        baseUrl: z.string().url().nullable().optional(),
        headers: z.record(z.string(), z.string()).optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.baseUrl) await assertSafeOutboundUrl(input.baseUrl);
      const { id, ...data } = input;
      return ctx.state.updateConnection(id, data);
    }),
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.state.deleteConnection(input.id)),
});

const evaluationScopeSchema = z.object({
  configurationId: z.string(),
  selectedIds: z.array(z.string()).max(100_000).optional(),
  filters: traceFiltersSchema.optional(),
});

const evaluationsRouter = router({
  templates: publicProcedure.query(({ ctx }) => ctx.state.listEvalTemplates()),
  createTemplate: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        prompt: z.string().trim().min(1).max(100_000),
        scoreName: z.string().trim().min(1).max(200),
        dataType: z.enum(["NUMERIC", "BOOLEAN", "CATEGORICAL"]),
        outputSchema: z.record(z.string(), z.unknown()).optional(),
        connectionId: z.string().nullable().optional(),
        model: z.string().trim().min(1).max(500).nullable().optional(),
        modelParameters: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(({ ctx, input }) => ctx.state.createEvalTemplate(input)),
  deleteTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.state.deleteEvalTemplate(input.id)),
  configurations: publicProcedure.query(({ ctx }) =>
    ctx.state.listEvalConfigurations(),
  ),
  createConfiguration: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(200),
        templateId: z.string(),
        targetType: targetTypeSchema,
        filter: z.record(z.string(), z.unknown()).optional(),
        variableMapping: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(({ ctx, input }) => ctx.state.createEvalConfiguration(input)),
  deleteConfiguration: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.state.deleteEvalConfiguration(input.id)),
  preview: publicProcedure
    .input(evaluationScopeSchema)
    .mutation(({ ctx, input }) =>
      previewEvaluationScope(ctx.database, input),
    ),
  enqueue: publicProcedure
    .input(evaluationScopeSchema.extend({ confirmedCount: z.number().int().min(1) }))
    .mutation(({ ctx, input }) => enqueueEvaluation(ctx.database, input)),
  runs: publicProcedure.query(({ ctx }) => ctx.state.listEvalRuns()),
  run: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => ctx.state.evalRun(input.id)),
  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      await ctx.database.$transaction([
        ctx.database.evalRun.update({
          where: { id: input.id },
          data: { status: "CANCELLED", cancelledAt: now, finishedAt: now },
        }),
        ctx.database.evalRunItem.updateMany({
          where: { runId: input.id, status: "PENDING" },
          data: { status: "CANCELLED", finishedAt: now },
        }),
      ]);
      return { cancelled: true };
    }),
});

export const appRouter = router({
  system: systemRouter,
  traces: tracesRouter,
  observations: observationsRouter,
  sessions: sessionsRouter,
  annotations: annotationsRouter,
  dashboards: dashboardsRouter,
  connections: connectionsRouter,
  evaluations: evaluationsRouter,
});

export type AppRouter = typeof appRouter;
