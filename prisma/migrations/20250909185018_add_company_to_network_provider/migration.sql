/*
  Warnings:

  - Added the required column `companyId` to the `NetworkProvider` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "NetworkProvider" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "NetworkProvider" ADD CONSTRAINT "NetworkProvider_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
