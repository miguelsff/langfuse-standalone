import { useState } from "react";

import { api } from "@/src/utils/api";
import { countLegacyApiEntrypoints } from "@/src/features/v4/utils";
import {
  aggregateLegacyApiUsage,
  createV4MigrationDetectionRange,
  getLegacyIntegrationLabels,
  getMigrationCountState,
  type ProjectMigrationStatus,
} from "@/src/features/v4-migration/migrationData";
import { getV4MigrationSdkState } from "@/src/features/v4-migration/sdkVersionStatus";

const QUERY_STALE_TIME_MS = 5 * 60 * 1000;

export type V4MigrationOrganization = {
  id: string;
  name: string;
  projects: { id: string; name: string }[];
};

const queryOptions = {
  refetchOnWindowFocus: false,
  staleTime: QUERY_STALE_TIME_MS,
};

export function useAccountV4MigrationData(params: {
  organizations: V4MigrationOrganization[];
  enabled: boolean;
}): Map<string, ProjectMigrationStatus> {
  const { organizations, enabled } = params;
  const [detectionRange] = useState(createV4MigrationDetectionRange);

  const integrationQueries = api.useQueries((t) =>
    organizations.map((organization) =>
      t.v4Transition.summaryByProject(
        { orgId: organization.id },
        {
          ...queryOptions,
          enabled,
        },
      ),
    ),
  );
  const evalQueries = api.useQueries((t) =>
    organizations.map((organization) =>
      t.v4Transition.traceLevelEvalSummaryByProject(
        { orgId: organization.id },
        {
          ...queryOptions,
          enabled,
          trpc: { context: { skipBatch: true } },
        },
      ),
    ),
  );
  const sdkQueries = api.useQueries((t) =>
    organizations.map((organization) =>
      t.v4Transition.sdkUsageSummaryByProject(
        {
          orgId: organization.id,
          ...detectionRange,
        },
        {
          ...queryOptions,
          enabled,
          trpc: { context: { skipBatch: true } },
        },
      ),
    ),
  );
  const apiQueries = api.useQueries((t) =>
    organizations.map((organization) =>
      t.v4Transition.legacyApiUsageSummaryByProject(
        {
          orgId: organization.id,
          ...detectionRange,
        },
        {
          ...queryOptions,
          enabled,
          trpc: { context: { skipBatch: true } },
        },
      ),
    ),
  );

  const statusByProjectId = new Map<string, ProjectMigrationStatus>();

  organizations.forEach((organization, organizationIndex) => {
    const integrationQuery = (integrationQueries[organizationIndex] ??
      null) as any;
    const evalQuery = (evalQueries[organizationIndex] ?? null) as any;
    const sdkQuery = (sdkQueries[organizationIndex] ?? null) as any;
    const apiQuery = (apiQueries[organizationIndex] ?? null) as any;

    organization.projects.forEach((project) => {
      const sdkSummary = (sdkQuery?.data as
        | Array<{ projectId: string }>
        | undefined)?.find(
        (row) => row.projectId === project.id,
      );
      statusByProjectId.set(project.id, {
        sdk: getV4MigrationSdkState({
          summary: sdkSummary,
          isLoading: sdkQuery?.data === undefined && !sdkQuery?.isError,
          isError: sdkQuery?.isError ?? false,
        }),
        evals: getMigrationCountState(evalQuery, (rows) => {
          const typedRows = rows as Array<{
            projectId: string;
            traceLevelEvalCount?: number;
          }>;
          return (
            typedRows.find((row) => row.projectId === project.id)
              ?.traceLevelEvalCount ?? 0
          );
        }),
        apis: getMigrationCountState(apiQuery, (rows) => {
          const typedRows = rows as Array<{
            projectId: string;
            entrypoint: string;
          }>;
          return countLegacyApiEntrypoints(
            typedRows.filter((row) => row.projectId === project.id),
          );
        }),
        exports: getMigrationCountState(integrationQuery, (data) => {
          const typedData = data as {
            projects: Array<{
              projectId: string;
              legacyIntegrationCount?: number;
            }>;
          };
          return (
            typedData.projects.find((row) => row.projectId === project.id)
              ?.legacyIntegrationCount ?? 0
          );
        }),
      });
    });
  });

  return statusByProjectId;
}

export function useProjectV4SdkData(params: {
  projectId: string | undefined;
  orgId: string | undefined;
  enabled: boolean;
}) {
  const { projectId, orgId, enabled } = params;
  const [detectionRange] = useState(createV4MigrationDetectionRange);
  const queryEnabled = enabled && Boolean(projectId) && Boolean(orgId);
  const sdkQuery = api.v4Transition.sdkUsageSummaryByProject.useQuery(
    {
      orgId: orgId ?? "",
      ...detectionRange,
    },
    {
      ...queryOptions,
      enabled: queryEnabled,
      trpc: { context: { skipBatch: true } },
    },
  );
  const summary = (sdkQuery.data as
    | Array<{ projectId: string }>
    | undefined)?.find((row) => row.projectId === projectId);

  return getV4MigrationSdkState({
    summary,
    isLoading: sdkQuery.data === undefined && !sdkQuery.isError,
    isError: sdkQuery.isError,
  });
}

export function useProjectV4MigrationData(params: {
  projectId: string | undefined;
  orgId: string | undefined;
  enabled: boolean;
}) {
  const { projectId, orgId, enabled } = params;
  const queryEnabled = enabled && Boolean(projectId);
  const [detectionRange] = useState(createV4MigrationDetectionRange);
  const sdk = useProjectV4SdkData({
    projectId,
    orgId,
    enabled,
  });
  const evalQuery = api.v4Transition.traceLevelEvalSummary.useQuery(
    { projectId: projectId ?? "" },
    { ...queryOptions, enabled: queryEnabled },
  );
  const apiQuery = api.v4Transition.timeSeriesByEntrypoint.useQuery(
    {
      projectId: projectId ?? "",
      ...detectionRange,
      granularity: "auto",
    },
    {
      ...queryOptions,
      enabled: queryEnabled,
      trpc: { context: { skipBatch: true } },
    },
  );
  const integrationQuery = api.v4Transition.summary.useQuery(
    { projectId: projectId ?? "" },
    { ...queryOptions, enabled: queryEnabled },
  );

  const apiUsage = aggregateLegacyApiUsage(apiQuery.data as any);
  const legacyIntegrations = getLegacyIntegrationLabels(
    (integrationQuery.data as any)?.legacyIntegrations,
  );

  return {
    sdk,
    evals: getMigrationCountState(
      evalQuery,
      (data) => (data as any).traceLevelEvalCount,
    ),
    apis: getMigrationCountState(apiQuery, () => apiUsage.length),
    exports: getMigrationCountState(
      integrationQuery,
      (data) => (data as any).legacyIntegrationCount,
    ),
    apiUsage,
    legacyIntegrations,
  };
}
