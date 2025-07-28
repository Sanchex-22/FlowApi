/*
  Warnings:

  - You are about to drop the column `isActive` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('Activo', 'Inactivo');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isActive";

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "contactEmail" TEXT,
    "phoneNumber" TEXT,
    "department" TEXT,
    "position" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'Activo',
    "userCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_userId_key" ON "Person"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_fullName_key" ON "Person"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Person_contactEmail_key" ON "Person"("contactEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Person_userCode_key" ON "Person"("userCode");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
