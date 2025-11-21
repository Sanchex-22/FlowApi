/*
  Warnings:

  - The values [standby,resolved,in_process] on the enum `TicketStatus` will be removed. If these variants are still used in the database, this will fail.
  - The `reviewed` column on the `Ticket` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TicketStatus_new" AS ENUM ('open', 'pending', 'approved', 'rejected', 'closed');
ALTER TABLE "Ticket" ALTER COLUMN "status" TYPE "TicketStatus_new" USING ("status"::text::"TicketStatus_new");
ALTER TYPE "TicketStatus" RENAME TO "TicketStatus_old";
ALTER TYPE "TicketStatus_new" RENAME TO "TicketStatus";
DROP TYPE "TicketStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "NetworkProvider" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "reviewed",
ADD COLUMN     "reviewed" BOOLEAN;
