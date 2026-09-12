-- CreateTable
CREATE TABLE "SystemSpec" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "doc" JSONB NOT NULL,
    "complexityTier" INTEGER NOT NULL DEFAULT 2,
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "openDecisions" INTEGER NOT NULL DEFAULT 0,
    "domain" TEXT NOT NULL DEFAULT 'software',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSpecVersion" (
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "doc" JSONB NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "authorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSpecVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemSpec_projectId_key" ON "SystemSpec"("projectId");

-- CreateIndex
CREATE INDEX "SystemSpec_projectId_idx" ON "SystemSpec"("projectId");

-- CreateIndex
CREATE INDEX "SystemSpecVersion_specId_createdAt_idx" ON "SystemSpecVersion"("specId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSpecVersion_specId_version_key" ON "SystemSpecVersion"("specId", "version");

-- AddForeignKey
ALTER TABLE "SystemSpec" ADD CONSTRAINT "SystemSpec_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSpecVersion" ADD CONSTRAINT "SystemSpecVersion_specId_fkey" FOREIGN KEY ("specId") REFERENCES "SystemSpec"("id") ON DELETE CASCADE ON UPDATE CASCADE;
