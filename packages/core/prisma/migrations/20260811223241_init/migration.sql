-- CreateTable
CREATE TABLE "HierarchyNode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "templateId" TEXT,
    "phaseType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parentId" INTEGER,
    CONSTRAINT "HierarchyNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "HierarchyNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeLogEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nodeId" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "start" DATETIME NOT NULL,
    "delta" INTEGER NOT NULL,
    "interrupt" INTEGER NOT NULL DEFAULT 0,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeLogEntry_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "HierarchyNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "HierarchyNode_path_key" ON "HierarchyNode"("path");

-- CreateIndex
CREATE INDEX "HierarchyNode_path_idx" ON "HierarchyNode"("path");

-- CreateIndex
CREATE UNIQUE INDEX "HierarchyNode_parentId_name_key" ON "HierarchyNode"("parentId", "name");

-- CreateIndex
CREATE INDEX "TimeLogEntry_nodeId_idx" ON "TimeLogEntry"("nodeId");

-- CreateIndex
CREATE INDEX "TimeLogEntry_path_idx" ON "TimeLogEntry"("path");

-- CreateIndex
CREATE INDEX "TimeLogEntry_start_idx" ON "TimeLogEntry"("start");
