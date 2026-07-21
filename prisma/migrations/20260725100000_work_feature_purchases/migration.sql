CREATE TYPE "WorkFeature" AS ENUM ('text_to_speech');

CREATE TABLE "WorkFeaturePurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "feature" "WorkFeature" NOT NULL,
    "coinsSpent" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkFeaturePurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkFeaturePurchase_userId_workId_feature_key"
ON "WorkFeaturePurchase"("userId", "workId", "feature");

CREATE INDEX "WorkFeaturePurchase_userId_purchasedAt_idx"
ON "WorkFeaturePurchase"("userId", "purchasedAt");

CREATE INDEX "WorkFeaturePurchase_workId_purchasedAt_idx"
ON "WorkFeaturePurchase"("workId", "purchasedAt");

ALTER TABLE "WorkFeaturePurchase"
ADD CONSTRAINT "WorkFeaturePurchase_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkFeaturePurchase"
ADD CONSTRAINT "WorkFeaturePurchase_workId_fkey"
FOREIGN KEY ("workId") REFERENCES "CreatorWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
