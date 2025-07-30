/*
  Warnings:

  - Made the column `userCode` on table `Person` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Person_fullName_key";

-- AlterTable
ALTER TABLE "Person" ALTER COLUMN "userCode" SET NOT NULL;
