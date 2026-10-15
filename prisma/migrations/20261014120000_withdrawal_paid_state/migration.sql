ALTER TYPE "WithdrawalStatus" ADD VALUE IF NOT EXISTS 'paid';
ALTER TABLE "WithdrawalRequest" ADD COLUMN "transferReference" TEXT, ADD COLUMN "paidAt" TIMESTAMP(3);
