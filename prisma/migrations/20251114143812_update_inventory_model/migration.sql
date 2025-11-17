/*
  Warnings:

  - You are about to drop the column `warrantyEndDate` on the `Equipment` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('vacations', 'permission', 'ticket');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('urgent', 'high', 'medium', 'low', 'trivial');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('standby', 'resolved', 'pending', 'in_process');

-- AlterTable
ALTER TABLE "Equipment" DROP COLUMN "warrantyEndDate",
ADD COLUMN     "endUser" TEXT,
ADD COLUMN     "operatingSystem" TEXT;

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketNumber" INTEGER,
    "title" VARCHAR(50) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "img" VARCHAR(250),
    "comment" VARCHAR(300),
    "type" "TicketType" NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "status" "TicketStatus" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "requestDays" INTEGER,
    "approvedDays" INTEGER,
    "reviewed" VARCHAR(50),
    "view" BOOLEAN,
    "sendById" TEXT,
    "sendToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_sendById_fkey" FOREIGN KEY ("sendById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_sendToId_fkey" FOREIGN KEY ("sendToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
