import { generateText, Output } from "ai";
import { z } from "zod";
import { getDatabase } from "@/server/db";
import { getEnv } from "@/server/env";
import { createLanguageModel } from "@/server/llm/provider";
import { LocalStateRepository } from "@/server/repositories/local-state";
import { renderEvaluationPrompt } from "@/server/evaluations/prompt";

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const outputForDataType = (dataType: string) => {
  const reason = z.string().max(10_000).optional();
  if (dataType === "BOOLEAN") {
    return Output.object({
      schema: z.object({ score: z.boolean(), reason }),
    });
  }
  if (dataType === "CATEGORICAL") {
    return Output.object({
      schema: z.object({ score: z.string().max(1_000), reason }),
    });
  }
  return Output.object({
    schema: z.object({ score: z.number(), reason }),
  });
};

const globalRunner = globalThis as unknown as {
  standaloneEvaluationRunner?: EvaluationRunner;
};

export class EvaluationRunner {
  private running = false;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    const database = await getDatabase();
    await database.evalRunItem.updateMany({
      where: { status: "RUNNING" },
      data: { status: "PENDING", startedAt: null },
    });
    await database.evalRun.updateMany({
      where: { status: "RUNNING" },
      data: { status: "PENDING", startedAt: null },
    });
    this.initialized = true;
    void this.kick();
  }

  async kick() {
    if (this.running) return;
    this.running = true;
    try {
      const concurrency = getEnv().EVAL_CONCURRENCY;
      while (true) {
        const results = await Promise.all(
          Array.from({ length: concurrency }, () => this.processNext()),
        );
        if (results.every((processed) => !processed)) break;
      }
    } finally {
      this.running = false;
    }
  }

  private async processNext() {
    const database = await getDatabase();
    const candidate = await database.evalRunItem.findFirst({
      where: {
        status: "PENDING",
        run: { status: { in: ["PENDING", "RUNNING"] } },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, runId: true },
    });
    if (!candidate) return false;

    const claimed = await database.evalRunItem.updateMany({
      where: { id: candidate.id, status: "PENDING" },
      data: { status: "RUNNING", startedAt: new Date(), attempt: { increment: 1 } },
    });
    if (claimed.count === 0) return true;

    await database.evalRun.update({
      where: { id: candidate.runId },
      data: {
        status: "RUNNING",
        startedAt: (await database.evalRun.findUnique({
          where: { id: candidate.runId },
          select: { startedAt: true },
        }))?.startedAt ?? new Date(),
      },
    });

    try {
      await this.evaluate(candidate.id);
      await database.evalRun.update({
        where: { id: candidate.runId },
        data: { completedCount: { increment: 1 } },
      });
    } catch (error) {
      await database.evalRunItem.update({
        where: { id: candidate.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          error:
            error instanceof Error
              ? error.message.slice(0, 4_000)
              : "Evaluation failed",
        },
      });
      await database.evalRun.update({
        where: { id: candidate.runId },
        data: { failedCount: { increment: 1 } },
      });
    }

    await this.finishRunIfComplete(candidate.runId);
    return true;
  }

  private async evaluate(itemId: string) {
    const database = await getDatabase();
    const item = await database.evalRunItem.findUniqueOrThrow({
      where: { id: itemId },
      include: {
        run: {
          include: {
            configuration: { include: { template: true } },
          },
        },
      },
    });
    const template = item.run.configuration.template;
    if (!template.connectionId || !template.model) {
      throw new Error("Evaluator template has no connection or model");
    }

    const state = new LocalStateRepository(database);
    const connection = await state.connectionWithSecrets(template.connectionId);
    const model = await createLanguageModel(connection, template.model);
    const prompt = renderEvaluationPrompt(
      template.prompt,
      parseJson(item.targetSnapshot, {}),
      parseJson(item.run.configuration.variableMapping, {}),
    );
    const parameters = parseJson<Record<string, unknown>>(
      template.modelParameters,
      {},
    );
    const result = await generateText({
      model,
      prompt,
      output: outputForDataType(template.dataType),
      temperature:
        typeof parameters.temperature === "number"
          ? parameters.temperature
          : undefined,
      maxOutputTokens:
        typeof parameters.maxOutputTokens === "number"
          ? parameters.maxOutputTokens
          : undefined,
      maxRetries: 2,
    });
    const output = result.output as {
      score: number | string | boolean;
      reason?: string;
    };

    await database.$transaction(async (transaction) => {
      const transactionState = new LocalStateRepository(transaction);
      await transactionState.createScore({
        targetType: item.targetType,
        targetId: item.targetId,
        name: template.scoreName,
        dataType: template.dataType,
        value:
          typeof output.score === "number"
            ? output.score
            : typeof output.score === "boolean"
              ? output.score
                ? 1
                : 0
              : null,
        stringValue:
          typeof output.score === "string" ? output.score : null,
        comment: output.reason,
        source: "EVALUATION",
        evalRunItemId: item.id,
      });
      await transaction.evalRunItem.update({
        where: { id: item.id },
        data: { status: "COMPLETED", finishedAt: new Date(), error: null },
      });
    });
  }

  private async finishRunIfComplete(runId: string) {
    const database = await getDatabase();
    const pending = await database.evalRunItem.count({
      where: { runId, status: { in: ["PENDING", "RUNNING"] } },
    });
    if (pending > 0) return;

    const failed = await database.evalRunItem.count({
      where: { runId, status: "FAILED" },
    });
    await database.evalRun.update({
      where: { id: runId },
      data: {
        status: failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        finishedAt: new Date(),
      },
    });
  }
}

export const getEvaluationRunner = () => {
  globalRunner.standaloneEvaluationRunner ??= new EvaluationRunner();
  return globalRunner.standaloneEvaluationRunner;
};
