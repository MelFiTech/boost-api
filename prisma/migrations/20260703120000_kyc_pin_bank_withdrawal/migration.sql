-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BankAccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "WalletTransactionCategory" ADD VALUE 'WITHDRAWAL';

-- CreateTable
CREATE TABLE "user_kyc" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bvnHash" TEXT NOT NULL,
    "ninHash" TEXT NOT NULL,
    "bvnLast4" TEXT NOT NULL,
    "ninLast4" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "bvnNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ninNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankCode" TEXT,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "status" "BankAccountStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_pins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_pins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_kyc_userId_key" ON "user_kyc"("userId");

-- CreateIndex
CREATE INDEX "bank_accounts_userId_status_idx" ON "bank_accounts"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_userId_bankName_accountNumber_key" ON "bank_accounts"("userId", "bankName", "accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_pins_userId_key" ON "transaction_pins"("userId");

-- AddForeignKey
ALTER TABLE "user_kyc" ADD CONSTRAINT "user_kyc_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_pins" ADD CONSTRAINT "transaction_pins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
