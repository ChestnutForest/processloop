-- CreateTable
CREATE TABLE "ActiveTimeSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nodeId" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "start" DATETIME NOT NULL,
    "state" TEXT NOT NULL,
    "workMillis" BIGINT NOT NULL DEFAULT 0,
    "interruptMillis" BIGINT NOT NULL DEFAULT 0,
    "stateChangedAt" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActiveTimeSession_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "HierarchyNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ActiveTimeSession_nodeId_key" ON "ActiveTimeSession"("nodeId");

-- CreateIndex
CREATE INDEX "ActiveTimeSession_path_idx" ON "ActiveTimeSession"("path");
