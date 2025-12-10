/*
  Warnings:

  - A unique constraint covering the columns `[ruc]` on the table `Company` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "ruc" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_ruc_key" ON "Company"("ruc");
