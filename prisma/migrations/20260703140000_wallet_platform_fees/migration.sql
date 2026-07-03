-- Wallet platform fees (admin-configurable)
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "fundingFee" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "withdrawalFee" DECIMAL(14,2) NOT NULL DEFAULT 0;
