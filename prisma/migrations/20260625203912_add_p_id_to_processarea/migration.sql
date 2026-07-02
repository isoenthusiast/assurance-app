/*
  Warnings:

  - You are about to drop the column `pid` on the `ProcessArea` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProcessArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pId" TEXT
);
INSERT INTO "new_ProcessArea" ("createdAt", "description", "id", "name") SELECT "createdAt", "description", "id", "name" FROM "ProcessArea";
DROP TABLE "ProcessArea";
ALTER TABLE "new_ProcessArea" RENAME TO "ProcessArea";
CREATE UNIQUE INDEX "ProcessArea_name_key" ON "ProcessArea"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
