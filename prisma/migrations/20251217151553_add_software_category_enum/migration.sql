/*
  Warnings:

  - You are about to drop the column `companyId` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('Active', 'Inactive', 'Pending', 'Canceled', 'Expired');

-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('Annual', 'Monthly', 'Quarterly', 'SemiAnnual', 'OneTime');

-- CreateEnum
CREATE TYPE "SoftwareCategory" AS ENUM ('Accounting', 'CRM', 'Antivirus', 'Productivity', 'Design', 'Development', 'HRManagement', 'Marketing', 'Communication', 'CloudStorage', 'OperatingSystem', 'Other');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "companyId";

-- CreateTable
CREATE TABLE "AnnualSoftwareExpense" (
    "id" TEXT NOT NULL,
    "applicationName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "category" "SoftwareCategory" NOT NULL,
    "status" "ExpenseStatus" NOT NULL,
    "annualCost" DOUBLE PRECISION NOT NULL,
    "numberOfUsers" INTEGER NOT NULL,
    "costPerUser" DOUBLE PRECISION NOT NULL,
    "renewalDate" TIMESTAMP(3) NOT NULL,
    "paymentFrequency" "PaymentFrequency" NOT NULL,
    "additionalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignedUsers" TEXT,

    CONSTRAINT "AnnualSoftwareExpense_pkey" PRIMARY KEY ("id")
);
