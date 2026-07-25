import type { Prisma, PrismaClient } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/server/encryption";

export const LOCAL_PROJECT_ID = "local";

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const withoutSecrets = <T extends {
  encryptedApiKey: string;
  encryptedHeaders: string | null;
}>(connection: T) => {
  const { encryptedApiKey: _apiKey, encryptedHeaders: _headers, ...safe } =
    connection;
  return {
    ...safe,
    hasApiKey: _apiKey.length > 0,
    hasCustomHeaders: Boolean(_headers),
  };
};

export class LocalStateRepository {
  constructor(
    private readonly db: PrismaClient | Prisma.TransactionClient,
  ) {}

  async deletedIds(targetType: string) {
    const values = await this.db.tombstone.findMany({
      where: { projectId: LOCAL_PROJECT_ID, targetType },
      select: { targetId: true },
    });
    return new Set(values.map(({ targetId }) => targetId));
  }

  async setDeleted(targetType: string, targetId: string, deleted: boolean) {
    if (deleted) {
      await this.db.tombstone.upsert({
        where: {
          projectId_targetType_targetId: {
            projectId: LOCAL_PROJECT_ID,
            targetType,
            targetId,
          },
        },
        update: {},
        create: { projectId: LOCAL_PROJECT_ID, targetType, targetId },
      });
    } else {
      await this.db.tombstone.deleteMany({
        where: { projectId: LOCAL_PROJECT_ID, targetType, targetId },
      });
    }
    return { deleted };
  }

  async toggleBookmark(targetType: string, targetId: string) {
    const where = {
      projectId_targetType_targetId: {
        projectId: LOCAL_PROJECT_ID,
        targetType,
        targetId,
      },
    };
    const existing = await this.db.bookmark.findUnique({ where });
    if (existing) {
      await this.db.bookmark.delete({ where });
      return { bookmarked: false };
    }
    await this.db.bookmark.create({
      data: { projectId: LOCAL_PROJECT_ID, targetType, targetId },
    });
    return { bookmarked: true };
  }

  async annotations(targetType: string, targetId: string) {
    const [bookmark, comments, scores, tombstone, media] = await Promise.all([
      this.db.bookmark.findUnique({
        where: {
          projectId_targetType_targetId: {
            projectId: LOCAL_PROJECT_ID,
            targetType,
            targetId,
          },
        },
      }),
      this.db.comment.findMany({
        where: { projectId: LOCAL_PROJECT_ID, targetType, targetId },
        orderBy: { createdAt: "desc" },
      }),
      this.db.score.findMany({
        where: {
          projectId: LOCAL_PROJECT_ID,
          ...(targetType === "TRACE"
            ? { traceId: targetId }
            : targetType === "OBSERVATION"
              ? { observationId: targetId }
              : { sessionId: targetId }),
        },
        orderBy: { createdAt: "desc" },
      }),
      this.db.tombstone.findUnique({
        where: {
          projectId_targetType_targetId: {
            projectId: LOCAL_PROJECT_ID,
            targetType,
            targetId,
          },
        },
      }),
      this.db.media.findMany({
        where: { projectId: LOCAL_PROJECT_ID, targetType, targetId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      bookmarked: Boolean(bookmark),
      deleted: Boolean(tombstone),
      comments,
      scores,
      media,
    };
  }

  createComment(targetType: string, targetId: string, content: string) {
    return this.db.comment.create({
      data: { projectId: LOCAL_PROJECT_ID, targetType, targetId, content },
    });
  }

  updateComment(id: string, content: string) {
    return this.db.comment.update({
      where: { id },
      data: { content },
    });
  }

  deleteComment(id: string) {
    return this.db.comment.delete({ where: { id } });
  }

  createScore(input: {
    targetType: string;
    targetId: string;
    name: string;
    dataType: string;
    value?: number | null;
    stringValue?: string | null;
    comment?: string | null;
    source?: string;
    evalRunItemId?: string;
  }) {
    return this.db.score.create({
      data: {
        projectId: LOCAL_PROJECT_ID,
        name: input.name,
        dataType: input.dataType,
        value: input.value,
        stringValue: input.stringValue,
        comment: input.comment,
        source: input.source ?? "ANNOTATION",
        evalRunItemId: input.evalRunItemId,
        traceId: input.targetType === "TRACE" ? input.targetId : null,
        observationId:
          input.targetType === "OBSERVATION" ? input.targetId : null,
        sessionId: input.targetType === "SESSION" ? input.targetId : null,
      },
    });
  }

  deleteScore(id: string) {
    return this.db.score.delete({ where: { id } });
  }

  listScores() {
    return this.db.score.findMany({
      where: { projectId: LOCAL_PROJECT_ID },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  }

  listDashboards() {
    return this.db.dashboard.findMany({
      where: { projectId: LOCAL_PROJECT_ID },
      include: { widgets: { orderBy: { position: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  createDashboard(name: string, description?: string) {
    return this.db.dashboard.create({
      data: { projectId: LOCAL_PROJECT_ID, name, description },
    });
  }

  deleteDashboard(id: string) {
    return this.db.dashboard.delete({ where: { id } });
  }

  addWidget(input: {
    dashboardId: string;
    title: string;
    metric: string;
    chartType: string;
  }) {
    return this.db.dashboardWidget.create({ data: input });
  }

  deleteWidget(id: string) {
    return this.db.dashboardWidget.delete({ where: { id } });
  }

  async listConnections() {
    const connections = await this.db.llmConnection.findMany({
      where: { projectId: LOCAL_PROJECT_ID },
      orderBy: { name: "asc" },
    });
    return connections.map(withoutSecrets);
  }

  async createConnection(input: {
    name: string;
    provider: string;
    adapter: string;
    apiKey: string;
    baseUrl?: string | null;
    headers?: Record<string, string>;
    config?: Record<string, unknown>;
  }) {
    const connection = await this.db.llmConnection.create({
      data: {
        projectId: LOCAL_PROJECT_ID,
        name: input.name,
        provider: input.provider,
        adapter: input.adapter,
        encryptedApiKey: encryptSecret(input.apiKey),
        baseUrl: input.baseUrl,
        encryptedHeaders:
          input.headers && Object.keys(input.headers).length > 0
            ? encryptSecret(JSON.stringify(input.headers))
            : null,
        config: JSON.stringify(input.config ?? {}),
      },
    });
    return withoutSecrets(connection);
  }

  async updateConnection(
    id: string,
    input: {
      name?: string;
      apiKey?: string;
      baseUrl?: string | null;
      headers?: Record<string, string>;
      config?: Record<string, unknown>;
    },
  ) {
    const data: Prisma.LlmConnectionUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.apiKey) data.encryptedApiKey = encryptSecret(input.apiKey);
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
    if (input.headers !== undefined) {
      data.encryptedHeaders =
        Object.keys(input.headers).length > 0
          ? encryptSecret(JSON.stringify(input.headers))
          : null;
    }
    if (input.config !== undefined) data.config = JSON.stringify(input.config);
    const connection = await this.db.llmConnection.update({
      where: { id },
      data,
    });
    return withoutSecrets(connection);
  }

  deleteConnection(id: string) {
    return this.db.llmConnection.delete({ where: { id } });
  }

  async connectionWithSecrets(id: string) {
    const connection = await this.db.llmConnection.findUniqueOrThrow({
      where: { id },
    });
    return {
      ...connection,
      apiKey: decryptSecret(connection.encryptedApiKey),
      headers: connection.encryptedHeaders
        ? parseJson<Record<string, string>>(
            decryptSecret(connection.encryptedHeaders),
            {},
          )
        : {},
      config: parseJson<Record<string, unknown>>(connection.config, {}),
    };
  }

  listEvalTemplates() {
    return this.db.evalTemplate.findMany({
      where: { projectId: LOCAL_PROJECT_ID },
      include: { connection: { select: { name: true, provider: true } } },
      orderBy: [{ name: "asc" }, { version: "desc" }],
    });
  }

  createEvalTemplate(input: {
    name: string;
    prompt: string;
    scoreName: string;
    dataType: string;
    outputSchema?: Record<string, unknown>;
    connectionId?: string | null;
    model?: string | null;
    modelParameters?: Record<string, unknown>;
  }) {
    return this.db.evalTemplate.create({
      data: {
        projectId: LOCAL_PROJECT_ID,
        name: input.name,
        prompt: input.prompt,
        scoreName: input.scoreName,
        dataType: input.dataType,
        outputSchema: JSON.stringify(input.outputSchema ?? {}),
        connectionId: input.connectionId,
        model: input.model,
        modelParameters: JSON.stringify(input.modelParameters ?? {}),
      },
    });
  }

  deleteEvalTemplate(id: string) {
    return this.db.evalTemplate.delete({ where: { id } });
  }

  listEvalConfigurations() {
    return this.db.evalConfiguration.findMany({
      where: { projectId: LOCAL_PROJECT_ID },
      include: { template: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  createEvalConfiguration(input: {
    name: string;
    templateId: string;
    targetType: string;
    filter?: Record<string, unknown>;
    variableMapping?: Record<string, string>;
  }) {
    return this.db.evalConfiguration.create({
      data: {
        projectId: LOCAL_PROJECT_ID,
        name: input.name,
        templateId: input.templateId,
        targetType: input.targetType,
        filter: JSON.stringify(input.filter ?? {}),
        variableMapping: JSON.stringify(input.variableMapping ?? {}),
      },
    });
  }

  deleteEvalConfiguration(id: string) {
    return this.db.evalConfiguration.delete({ where: { id } });
  }

  listEvalRuns() {
    return this.db.evalRun.findMany({
      where: { projectId: LOCAL_PROJECT_ID },
      include: { configuration: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  evalRun(id: string) {
    return this.db.evalRun.findUnique({
      where: { id },
      include: {
        configuration: { include: { template: true } },
        items: { include: { score: true }, orderBy: { createdAt: "asc" } },
      },
    });
  }
}
