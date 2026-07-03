-- Admin-configurable SMM web flow URL for the mobile app (production).
ALTER TABLE "app_settings" ADD COLUMN "smmWebUrl" TEXT;
