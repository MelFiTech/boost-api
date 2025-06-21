/*
  Warnings:

  - You are about to drop the `smm_services` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[serviceId,providerId]` on the table `services` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `providerId` to the `services` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- DropIndex
DROP INDEX "services_serviceId_key";

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "providerId" TEXT NOT NULL;

-- DropTable
DROP TABLE "smm_services";

-- CreateTable
CREATE TABLE "service_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "budpayReference" TEXT NOT NULL,
    "ourReference" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "budpayStatus" TEXT,
    "accountNumber" TEXT,
    "bankName" TEXT,
    "customerEmail" TEXT,
    "narration" TEXT,
    "sessionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "webhookReceived" BOOLEAN NOT NULL DEFAULT false,
    "webhookData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_providers_name_key" ON "service_providers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "service_providers_slug_key" ON "service_providers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_budpayReference_key" ON "transactions"("budpayReference");

-- CreateIndex
CREATE UNIQUE INDEX "services_serviceId_providerId_key" ON "services"("serviceId", "providerId");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "service_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
