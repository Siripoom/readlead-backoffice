CREATE TYPE "CoinTopUpStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "CoinTopUpRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "baseCoins" INTEGER NOT NULL,
    "bonusCoins" INTEGER NOT NULL,
    "totalCoins" INTEGER NOT NULL,
    "amountSatang" INTEGER NOT NULL,
    "status" "CoinTopUpStatus" NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT NOT NULL,
    "slipObjectKey" TEXT NOT NULL,
    "slipUrl" TEXT NOT NULL,
    "slipContentType" TEXT NOT NULL,
    "slipSizeBytes" INTEGER NOT NULL,
    "slipOriginalName" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinTopUpRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoinTopUpRequest_idempotencyKey_key" ON "CoinTopUpRequest"("idempotencyKey");
CREATE UNIQUE INDEX "CoinTopUpRequest_slipObjectKey_key" ON "CoinTopUpRequest"("slipObjectKey");
CREATE INDEX "CoinTopUpRequest_userId_submittedAt_idx" ON "CoinTopUpRequest"("userId", "submittedAt");
CREATE INDEX "CoinTopUpRequest_status_submittedAt_idx" ON "CoinTopUpRequest"("status", "submittedAt");
CREATE INDEX "CoinTopUpRequest_reviewerId_idx" ON "CoinTopUpRequest"("reviewerId");

ALTER TABLE "CoinTopUpRequest"
ADD CONSTRAINT "CoinTopUpRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CoinTopUpRequest"
ADD CONSTRAINT "CoinTopUpRequest_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
