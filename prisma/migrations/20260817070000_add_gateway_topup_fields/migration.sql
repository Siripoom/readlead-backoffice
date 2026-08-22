-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CoinTopUpStatus" ADD VALUE 'authorizing';
ALTER TYPE "CoinTopUpStatus" ADD VALUE 'failed';
ALTER TYPE "CoinTopUpStatus" ADD VALUE 'expired';

-- AlterTable
ALTER TABLE "CoinTopUpRequest" ADD COLUMN     "amountReceivedSatang" INTEGER,
ADD COLUMN     "omiseChargeId" TEXT,
ADD COLUMN     "omiseChargeStatus" TEXT,
ADD COLUMN     "omiseSourceType" TEXT,
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'proof-upload',
ALTER COLUMN "slipObjectKey" DROP NOT NULL,
ALTER COLUMN "slipUrl" DROP NOT NULL,
ALTER COLUMN "slipContentType" DROP NOT NULL,
ALTER COLUMN "slipSizeBytes" DROP NOT NULL,
ALTER COLUMN "slipOriginalName" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CoinTopUpRequest_omiseChargeId_key" ON "CoinTopUpRequest"("omiseChargeId");

