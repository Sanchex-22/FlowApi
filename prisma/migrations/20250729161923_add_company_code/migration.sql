/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Company` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "code" TEXT NOT NULL DEFAULT 'CO001';

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");
