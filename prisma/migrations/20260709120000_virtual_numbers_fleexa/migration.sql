-- Virtual numbers product (Fleexa SMS OTP first)
ALTER TYPE "WalletTransactionCategory" ADD VALUE IF NOT EXISTS 'VIRTUAL_NUMBER';
ALTER TYPE "ProviderKind" ADD VALUE IF NOT EXISTS 'VIRTUAL_NUMBERS';

CREATE TYPE "VirtualNumberProductType" AS ENUM ('SMS_OTP', 'EMAIL_OTP', 'RENT_NUMBER');
CREATE TYPE "FleexaSmsServer" AS ENUM ('SMS1', 'SMS2', 'SMS3');
CREATE TYPE "VirtualNumberRentalStatus" AS ENUM (
  'PENDING',
  'WAITING',
  'RECEIVED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
  'REFUNDED'
);

CREATE TABLE "virtual_number_rentals" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productType" "VirtualNumberProductType" NOT NULL DEFAULT 'SMS_OTP',
  "smsServer" "FleexaSmsServer" NOT NULL DEFAULT 'SMS1',
  "provider" TEXT NOT NULL DEFAULT 'fleexa',
  "providerRequestId" TEXT,
  "walletTransactionId" TEXT,
  "countryName" TEXT,
  "countryId" TEXT,
  "appName" TEXT,
  "projectId" TEXT,
  "phoneNumber" TEXT,
  "amountCharged" DECIMAL(14,2) NOT NULL,
  "providerCost" DECIMAL(14,2),
  "status" "VirtualNumberRentalStatus" NOT NULL DEFAULT 'PENDING',
  "smsCode" TEXT,
  "smsBody" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "virtual_number_rentals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "virtual_number_rentals_walletTransactionId_key"
  ON "virtual_number_rentals"("walletTransactionId");
CREATE INDEX "virtual_number_rentals_userId_createdAt_idx"
  ON "virtual_number_rentals"("userId", "createdAt");
CREATE INDEX "virtual_number_rentals_status_updatedAt_idx"
  ON "virtual_number_rentals"("status", "updatedAt");
CREATE INDEX "virtual_number_rentals_providerRequestId_idx"
  ON "virtual_number_rentals"("providerRequestId");

ALTER TABLE "virtual_number_rentals"
  ADD CONSTRAINT "virtual_number_rentals_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "virtual_number_rentals"
  ADD CONSTRAINT "virtual_number_rentals_walletTransactionId_fkey"
  FOREIGN KEY ("walletTransactionId") REFERENCES "wallet_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
