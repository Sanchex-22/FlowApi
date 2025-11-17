/*
  Warnings:

  - A unique constraint covering the columns `[name,companyId]` on the table `NetworkProvider` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "NetworkProvider_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "NetworkProvider_name_companyId_key" ON "NetworkProvider"("name", "companyId");
