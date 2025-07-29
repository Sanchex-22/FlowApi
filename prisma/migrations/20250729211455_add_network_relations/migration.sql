-- CreateEnum
CREATE TYPE "NetworkDeviceType" AS ENUM ('ROUTER', 'SWITCH', 'FIREWALL', 'ACCESS_POINT', 'SERVER', 'PRINTER', 'IP_PHONE', 'CAMERA', 'OTHER');

-- CreateEnum
CREATE TYPE "NetworkDeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE', 'DECOMMISSIONED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Network" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "macAddress" TEXT,
    "deviceType" "NetworkDeviceType" NOT NULL DEFAULT 'OTHER',
    "status" "NetworkDeviceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "location" TEXT,
    "description" TEXT,
    "serialNumber" TEXT,
    "model" TEXT,
    "brand" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "warrantyEndDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "assignedToUserId" TEXT,

    CONSTRAINT "Network_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Network_ipAddress_key" ON "Network"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Network_macAddress_key" ON "Network"("macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Network_serialNumber_key" ON "Network"("serialNumber");

-- AddForeignKey
ALTER TABLE "Network" ADD CONSTRAINT "Network_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Network" ADD CONSTRAINT "Network_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
