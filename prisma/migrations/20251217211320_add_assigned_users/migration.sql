/*
  Warnings:

  - You are about to drop the column `assignedUsers` on the `AnnualSoftwareExpense` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AnnualSoftwareExpense" DROP COLUMN "assignedUsers";

-- CreateTable
CREATE TABLE "AssignedUser" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignedUser_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AssignedUser" ADD CONSTRAINT "AssignedUser_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "AnnualSoftwareExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
