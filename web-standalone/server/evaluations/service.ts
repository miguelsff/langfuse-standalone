import type { PrismaClient } from "@prisma/client";
import { getTelemetryStore, type TraceFilters } from "@/server/data/store";
import { getEvaluationRunner } from "@/server/evaluations/runner";
import { LOCAL_PROJECT_ID } from "@/server/repositories/local-state";

type EvalScope = {
  configurationId: string;
  selectedIds?: string[];
  filters?: TraceFilters;
};

const targetsForScope = async (database: PrismaClient, scope: EvalScope) => {
  const configuration = await database.evalConfiguration.findUniqueOrThrow({
    where: { id: scope.configurationId },
  });
  const store = getTelemetryStore();
  const selected = new Set(scope.selectedIds ?? []);
  let targets: Array<{ id: string }>;

  if (configuration.targetType === "TRACE") {
    const deleted = new Set(
      (
        await database.tombstone.findMany({
          where: { projectId: LOCAL_PROJECT_ID, targetType: "TRACE" },
          select: { targetId: true },
        })
      ).map(({ targetId }) => targetId),
    );
    targets = store.allMatchingTraces(scope.filters ?? {}, deleted);
  } else if (configuration.targetType === "OBSERVATION") {
    targets = store.listObservations(new Set(), 1, 100_000).items;
  } else {
    targets = store.listSessions(new Set());
  }

  if (selected.size > 0) {
    targets = targets.filter(({ id }) => selected.has(id));
  }
  return { configuration, targets };
};

export const previewEvaluationScope = async (
  database: PrismaClient,
  scope: EvalScope,
) => {
  const { configuration, targets } = await targetsForScope(database, scope);
  return {
    targetType: configuration.targetType,
    count: targets.length,
    sampleIds: targets.slice(0, 10).map(({ id }) => id),
  };
};

export const enqueueEvaluation = async (
  database: PrismaClient,
  scope: EvalScope & { confirmedCount: number },
) => {
  const { configuration, targets } = await targetsForScope(database, scope);
  if (targets.length !== scope.confirmedCount) {
    throw new Error(
      `The target count changed: expected ${scope.confirmedCount}, found ${targets.length}`,
    );
  }
  if (targets.length === 0) {
    throw new Error("The evaluation scope is empty");
  }
  if (targets.length > 100_000) {
    throw new Error("A single evaluation run cannot exceed 100,000 targets");
  }

  const run = await database.evalRun.create({
    data: {
      projectId: LOCAL_PROJECT_ID,
      configurationId: configuration.id,
      requestedCount: targets.length,
      items: {
        create: targets.map(({ id }) => ({
          targetType: configuration.targetType,
          targetId: id,
          targetSnapshot: JSON.stringify(
            getTelemetryStore().getTargetSnapshot(configuration.targetType, id),
          ),
        })),
      },
    },
  });
  void getEvaluationRunner().kick();
  return run;
};
