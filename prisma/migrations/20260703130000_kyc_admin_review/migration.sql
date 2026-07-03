-- AlterTable: store full KYC details for admin review
ALTER TABLE "user_kyc" ADD COLUMN IF NOT EXISTS "bvn" TEXT;
ALTER TABLE "user_kyc" ADD COLUMN IF NOT EXISTS "nin" TEXT;
ALTER TABLE "user_kyc" ADD COLUMN IF NOT EXISTS "bvnFullName" TEXT;
ALTER TABLE "user_kyc" ADD COLUMN IF NOT EXISTS "ninFullName" TEXT;
ALTER TABLE "user_kyc" ADD COLUMN IF NOT EXISTS "bvnIdentityData" JSONB;
ALTER TABLE "user_kyc" ADD COLUMN IF NOT EXISTS "ninIdentityData" JSONB;
ALTER TABLE "user_kyc" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;
ALTER TABLE "user_kyc" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "user_kyc" ADD COLUMN IF NOT EXISTS "adminNote" TEXT;
ALTER TABLE "user_kyc" ADD COLUMN IF NOT EXISTS "verificationMode" TEXT;
