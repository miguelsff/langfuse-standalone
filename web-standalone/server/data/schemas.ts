import { z } from "zod";

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const traceSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().nullable().optional(),
    timestamp: z.iso.datetime({ offset: true }),
    userId: z.string().nullable().optional(),
    sessionId: z.string().nullable().optional(),
    release: z.string().nullable().optional(),
    version: z.string().nullable().optional(),
    tags: z.array(z.string()).default([]),
    metadata: jsonValueSchema.optional(),
    input: jsonValueSchema.optional(),
    output: jsonValueSchema.optional(),
    level: z.string().default("DEFAULT"),
    statusMessage: z.string().nullable().optional(),
    durationMs: z.number().nonnegative().nullable().optional(),
    totalCost: z.number().nonnegative().nullable().optional(),
  })
  .passthrough();

export const observationSchema = z
  .object({
    id: z.string().min(1),
    traceId: z.string().min(1),
    parentObservationId: z.string().nullable().optional(),
    type: z.enum([
      "SPAN",
      "GENERATION",
      "EVENT",
      "AGENT",
      "TOOL",
      "CHAIN",
      "RETRIEVER",
      "EVALUATOR",
      "EMBEDDING",
      "GUARDRAIL",
    ]),
    name: z.string().nullable().optional(),
    startTime: z.iso.datetime({ offset: true }),
    endTime: z.iso.datetime({ offset: true }).nullable().optional(),
    model: z.string().nullable().optional(),
    input: jsonValueSchema.optional(),
    output: jsonValueSchema.optional(),
    metadata: jsonValueSchema.optional(),
    level: z.string().default("DEFAULT"),
    statusMessage: z.string().nullable().optional(),
    usage: z
      .object({
        input: z.number().nonnegative().optional(),
        output: z.number().nonnegative().optional(),
        total: z.number().nonnegative().optional(),
      })
      .optional(),
    cost: z
      .object({
        input: z.number().nonnegative().optional(),
        output: z.number().nonnegative().optional(),
        total: z.number().nonnegative().optional(),
      })
      .optional(),
  })
  .passthrough();

export const sessionSchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.iso.datetime({ offset: true }).optional(),
    userId: z.string().nullable().optional(),
    metadata: jsonValueSchema.optional(),
  })
  .passthrough();

export const telemetryBundleSchema = z.object({
  version: z.literal(1),
  traces: z.array(traceSchema).default([]),
  observations: z.array(observationSchema).default([]),
  sessions: z.array(sessionSchema).default([]),
});

export type TraceRecord = z.infer<typeof traceSchema>;
export type ObservationRecord = z.infer<typeof observationSchema>;
export type SessionRecord = z.infer<typeof sessionSchema>;
export type TelemetryBundle = z.infer<typeof telemetryBundleSchema>;
