/*
  Warnings:

  - The values [PENDING_PAYMENT,PAYMENT_PROCESSING,CONFIRMED,IN_PROGRESS] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `description` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `displayName` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `sortOrder` on the `categories` table. All the data in the column will be lost.
  - You are about to drop the column `externalOrderId` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `guestEmail` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `targetUrl` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `totalAmount` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `displayName` on the `platforms` table. All the data in the column will be lost.
  - You are about to drop the column `externalId` on the `platforms` table. All the data in the column will be lost.
  - You are about to drop the column `iconUrl` on the `platforms` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `platforms` table. All the data in the column will be lost.
  - You are about to drop the column `urlPatterns` on the `platforms` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `externalId` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `maxQuantity` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `minQuantity` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `pricePerUnit` on the `services` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[platformId,slug]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `platforms` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `platforms` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[serviceId]` on the table `services` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `platformId` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `link` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `platforms` table without a default value. This is not possible if the table is not empty.
  - Added the required column `boostRate` to the `services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxOrder` to the `services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minOrder` to the `services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerRate` to the `services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceId` to the `services` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `services` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropIndex
DROP INDEX "categories_name_key";

-- DropIndex
DROP INDEX "platforms_externalId_key";

-- DropIndex
DROP INDEX "services_externalId_key";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "description",
DROP COLUMN "displayName",
DROP COLUMN "isActive",
DROP COLUMN "sortOrder",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "platformId" TEXT NOT NULL,
ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "externalOrderId",
DROP COLUMN "guestEmail",
DROP COLUMN "paymentMethod",
DROP COLUMN "targetUrl",
DROP COLUMN "totalAmount",
ADD COLUMN     "link" TEXT NOT NULL,
ADD COLUMN     "price" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "providerOrderId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "platforms" DROP COLUMN "displayName",
DROP COLUMN "externalId",
DROP COLUMN "iconUrl",
DROP COLUMN "isActive",
DROP COLUMN "urlPatterns",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "services" DROP COLUMN "description",
DROP COLUMN "externalId",
DROP COLUMN "isActive",
DROP COLUMN "maxQuantity",
DROP COLUMN "minQuantity",
DROP COLUMN "pricePerUnit",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "boostRate" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "cancel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dripfeed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "maxOrder" INTEGER NOT NULL,
ADD COLUMN     "minOrder" INTEGER NOT NULL,
ADD COLUMN     "providerRate" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "refill" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serviceId" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "categories_platformId_slug_key" ON "categories"("platformId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_name_key" ON "platforms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "services_serviceId_key" ON "services"("serviceId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
