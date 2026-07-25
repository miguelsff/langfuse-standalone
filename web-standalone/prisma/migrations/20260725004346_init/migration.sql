-- CreateTable
CREATE TABLE "LocalProject" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'local',
    "name" TEXT NOT NULL DEFAULT 'Local project',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL DEFAULT 'local',
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LocalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL DEFAULT 'local',
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL DEFAULT 'local-user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LocalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScoreConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'NUMERIC',
    "description" TEXT,
    "categories" TEXT,
    "minValue" REAL,
    "maxValue" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScoreConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LocalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL DEFAULT 'local',
    "traceId" TEXT,
    "observationId" TEXT,
    "sessionId" TEXT,
    "name" TEXT NOT NULL,
    "value" REAL,
    "stringValue" TEXT,
    "dataType" TEXT NOT NULL DEFAULT 'NUMERIC',
    "source" TEXT NOT NULL DEFAULT 'ANNOTATION',
    "comment" TEXT,
    "authorId" TEXT NOT NULL DEFAULT 'local-user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "evalRunItemId" TEXT,
    CONSTRAINT "Score_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LocalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Score_evalRunItemId_fkey" FOREIGN KEY ("evalRunItemId") REFERENCES "EvalRunItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tombstone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL DEFAULT 'local',
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tombstone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LocalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dashboard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dashboard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LocalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DashboardWidget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dashboardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "chartType" TEXT NOT NULL DEFAULT 'NUMBER',
    "config" TEXT NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DashboardWidget_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL DEFAULT 'local',
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Media_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LocalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LlmConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "baseUrl" TEXT,
    "encryptedHeaders" TEXT,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LlmConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LocalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DefaultEvalModel" (
    "projectId" TEXT NOT NULL PRIMARY KEY DEFAULT 'local',
    "connectionId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DefaultEvalModel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LocalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DefaultEvalModel_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "LlmConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvalTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "prompt" TEXT NOT NULL,
    "scoreName" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'NUMERIC',
    "outputSchema" TEXT NOT NULL DEFAULT '{}',
    "model" TEXT,
    "connectionId" TEXT,
    "modelParameters" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvalTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LocalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvalTemplate_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "LlmConnection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvalConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL DEFAULT 'local',
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "filter" TEXT NOT NULL DEFAULT '{}',
    "variableMapping" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvalConfiguration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LocalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvalConfiguration_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EvalTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvalRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL DEFAULT 'local',
    "configurationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedCount" INTEGER NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" DATETIME,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvalRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LocalProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvalRun_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "EvalConfiguration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvalRunItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EvalRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvalRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Bookmark_projectId_targetType_idx" ON "Bookmark"("projectId", "targetType");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_projectId_targetType_targetId_key" ON "Bookmark"("projectId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "Comment_projectId_targetType_targetId_idx" ON "Comment"("projectId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreConfig_projectId_name_key" ON "ScoreConfig"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Score_evalRunItemId_key" ON "Score"("evalRunItemId");

-- CreateIndex
CREATE INDEX "Score_projectId_traceId_idx" ON "Score"("projectId", "traceId");

-- CreateIndex
CREATE INDEX "Score_projectId_observationId_idx" ON "Score"("projectId", "observationId");

-- CreateIndex
CREATE INDEX "Score_projectId_sessionId_idx" ON "Score"("projectId", "sessionId");

-- CreateIndex
CREATE INDEX "Score_projectId_name_idx" ON "Score"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Tombstone_projectId_targetType_targetId_key" ON "Tombstone"("projectId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Dashboard_projectId_name_key" ON "Dashboard"("projectId", "name");

-- CreateIndex
CREATE INDEX "DashboardWidget_dashboardId_position_idx" ON "DashboardWidget"("dashboardId", "position");

-- CreateIndex
CREATE INDEX "Media_projectId_targetType_targetId_idx" ON "Media"("projectId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "LlmConnection_projectId_name_key" ON "LlmConnection"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DefaultEvalModel_connectionId_key" ON "DefaultEvalModel"("connectionId");

-- CreateIndex
CREATE INDEX "EvalTemplate_projectId_name_idx" ON "EvalTemplate"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "EvalTemplate_projectId_name_version_key" ON "EvalTemplate"("projectId", "name", "version");

-- CreateIndex
CREATE INDEX "EvalConfiguration_projectId_targetType_idx" ON "EvalConfiguration"("projectId", "targetType");

-- CreateIndex
CREATE UNIQUE INDEX "EvalConfiguration_projectId_name_key" ON "EvalConfiguration"("projectId", "name");

-- CreateIndex
CREATE INDEX "EvalRun_projectId_status_createdAt_idx" ON "EvalRun"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EvalRunItem_status_createdAt_idx" ON "EvalRunItem"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvalRunItem_runId_targetType_targetId_key" ON "EvalRunItem"("runId", "targetType", "targetId");
