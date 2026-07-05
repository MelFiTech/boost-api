-- Receipt email captured on the SMM web payment step
ALTER TABLE "payments" ADD COLUMN "customerEmail" TEXT;
