-- CreateEnum
CREATE TYPE "CreatorWorkType" AS ENUM ('novel', 'manga', 'audiobook');

-- CreateEnum
CREATE TYPE "CreatorWorkOrigin" AS ENUM ('original', 'translated');

-- CreateEnum
CREATE TYPE "CreatorWorkStatus" AS ENUM ('draft', 'pending_review', 'published', 'rejected', 'deletion_pending', 'archived');

-- CreateEnum
CREATE TYPE "CreatorEpisodeType" AS ENUM ('text', 'image', 'audio');

-- CreateEnum
CREATE TYPE "CreatorEpisodeStatus" AS ENUM ('draft', 'scheduled', 'published', 'hidden');

-- CreateEnum
CREATE TYPE "CreatorModerationType" AS ENUM ('translation', 'deletion');

-- CreateEnum
CREATE TYPE "CreatorModerationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "CoinLedgerKind" AS ENUM ('topup', 'purchase', 'refund', 'adjustment');

-- CreateEnum
CREATE TYPE "CreatorRevenueKind" AS ENUM ('earning', 'withdrawal_reserve', 'withdrawal_release', 'withdrawal_paid', 'adjustment');

-- AlterTable
ALTER TABLE "WithdrawalRequest" ADD COLUMN     "amountSatang" INTEGER,
ADD COLUMN     "encryptedDestination" TEXT,
ADD COLUMN     "feeSatang" INTEGER DEFAULT 0,
ADD COLUMN     "netSatang" INTEGER,
ADD COLUMN     "payoutMode" TEXT NOT NULL DEFAULT 'advance',
ADD COLUMN     "payoutPeriod" TEXT,
ADD COLUMN     "taxSatang" INTEGER,
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "CreatorWork" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "type" "CreatorWorkType" NOT NULL,
    "origin" "CreatorWorkOrigin" NOT NULL DEFAULT 'original',
    "status" "CreatorWorkStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rating" TEXT NOT NULL DEFAULT 'general',
    "creationMethod" TEXT NOT NULL DEFAULT 'self_written',
    "tagline" TEXT NOT NULL DEFAULT '',
    "synopsis" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "originalAuthor" TEXT,
    "translatorName" TEXT,
    "originalLanguage" TEXT,
    "originalTitle" TEXT,
    "coverObjectKey" TEXT,
    "coverContentType" TEXT,
    "coverIsPublic" BOOLEAN NOT NULL DEFAULT false,
    "seriesStatus" TEXT NOT NULL DEFAULT 'ongoing',
    "rejectionReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "shelfCount" INTEGER NOT NULL DEFAULT 0,
    "dailyVotes" INTEGER NOT NULL DEFAULT 0,
    "monthlyVotes" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorEpisode" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CreatorEpisodeType" NOT NULL,
    "status" "CreatorEpisodeStatus" NOT NULL DEFAULT 'draft',
    "priceCoins" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkAsset" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "episodeId" TEXT,
    "kind" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorModerationRequest" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "type" "CreatorModerationType" NOT NULL,
    "status" "CreatorModerationStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorModerationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkMetricDaily" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "revenueSatang" INTEGER NOT NULL DEFAULT 0,
    "shelfAdds" INTEGER NOT NULL DEFAULT 0,
    "dailyVotes" INTEGER NOT NULL DEFAULT 0,
    "monthlyVotes" INTEGER NOT NULL DEFAULT 0,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkMetricDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkShelf" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkShelf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkView" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "workId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "viewedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkComment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodePurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "coinsSpent" INTEGER NOT NULL,
    "revenueSatang" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CoinLedgerKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorRevenueLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CreatorRevenueKind" NOT NULL,
    "amountSatang" INTEGER NOT NULL,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorRevenueLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorWork_creatorId_status_updatedAt_idx" ON "CreatorWork"("creatorId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CreatorWork_status_publishedAt_idx" ON "CreatorWork"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "CreatorWork_type_status_idx" ON "CreatorWork"("type", "status");

-- CreateIndex
CREATE INDEX "CreatorEpisode_workId_status_episodeNumber_idx" ON "CreatorEpisode"("workId", "status", "episodeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorEpisode_workId_episodeNumber_key" ON "CreatorEpisode"("workId", "episodeNumber");

-- CreateIndex
CREATE INDEX "WorkAsset_workId_episodeId_sortOrder_idx" ON "WorkAsset"("workId", "episodeId", "sortOrder");

-- CreateIndex
CREATE INDEX "CreatorModerationRequest_status_submittedAt_idx" ON "CreatorModerationRequest"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "CreatorModerationRequest_workId_type_status_idx" ON "CreatorModerationRequest"("workId", "type", "status");

-- CreateIndex
CREATE INDEX "WorkMetricDaily_date_idx" ON "WorkMetricDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkMetricDaily_workId_date_key" ON "WorkMetricDaily"("workId", "date");

-- CreateIndex
CREATE INDEX "CreatorFollow_creatorId_idx" ON "CreatorFollow"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorFollow_followerId_creatorId_key" ON "CreatorFollow"("followerId", "creatorId");

-- CreateIndex
CREATE INDEX "WorkShelf_workId_idx" ON "WorkShelf"("workId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkShelf_userId_workId_key" ON "WorkShelf"("userId", "workId");

-- CreateIndex
CREATE INDEX "WorkView_workId_viewedOn_idx" ON "WorkView"("workId", "viewedOn");

-- CreateIndex
CREATE UNIQUE INDEX "WorkView_workId_viewerKey_viewedOn_key" ON "WorkView"("workId", "viewerKey", "viewedOn");

-- CreateIndex
CREATE INDEX "WorkReview_workId_status_createdAt_idx" ON "WorkReview"("workId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkReview_userId_workId_key" ON "WorkReview"("userId", "workId");

-- CreateIndex
CREATE INDEX "WorkComment_workId_status_createdAt_idx" ON "WorkComment"("workId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkComment_parentId_idx" ON "WorkComment"("parentId");

-- CreateIndex
CREATE INDEX "EpisodePurchase_workId_purchasedAt_idx" ON "EpisodePurchase"("workId", "purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodePurchase_userId_episodeId_key" ON "EpisodePurchase"("userId", "episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinAccount_userId_key" ON "CoinAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CoinLedger_idempotencyKey_key" ON "CoinLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CoinLedger_userId_createdAt_idx" ON "CoinLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinLedger_referenceId_idx" ON "CoinLedger"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorRevenueLedger_idempotencyKey_key" ON "CreatorRevenueLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CreatorRevenueLedger_userId_createdAt_idx" ON "CreatorRevenueLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CreatorRevenueLedger_referenceId_idx" ON "CreatorRevenueLedger"("referenceId");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_userId_status_requestedAt_idx" ON "WithdrawalRequest"("userId", "status", "requestedAt");

-- AddForeignKey
ALTER TABLE "CreatorWork" ADD CONSTRAINT "CreatorWork_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorEpisode" ADD CONSTRAINT "CreatorEpisode_workId_fkey" FOREIGN KEY ("workId") REFERENCES "CreatorWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAsset" ADD CONSTRAINT "WorkAsset_workId_fkey" FOREIGN KEY ("workId") REFERENCES "CreatorWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAsset" ADD CONSTRAINT "WorkAsset_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "CreatorEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorModerationRequest" ADD CONSTRAINT "CreatorModerationRequest_workId_fkey" FOREIGN KEY ("workId") REFERENCES "CreatorWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkMetricDaily" ADD CONSTRAINT "WorkMetricDaily_workId_fkey" FOREIGN KEY ("workId") REFERENCES "CreatorWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorFollow" ADD CONSTRAINT "CreatorFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorFollow" ADD CONSTRAINT "CreatorFollow_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkShelf" ADD CONSTRAINT "WorkShelf_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkShelf" ADD CONSTRAINT "WorkShelf_workId_fkey" FOREIGN KEY ("workId") REFERENCES "CreatorWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkView" ADD CONSTRAINT "WorkView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkView" ADD CONSTRAINT "WorkView_workId_fkey" FOREIGN KEY ("workId") REFERENCES "CreatorWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkReview" ADD CONSTRAINT "WorkReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkReview" ADD CONSTRAINT "WorkReview_workId_fkey" FOREIGN KEY ("workId") REFERENCES "CreatorWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkComment" ADD CONSTRAINT "WorkComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkComment" ADD CONSTRAINT "WorkComment_workId_fkey" FOREIGN KEY ("workId") REFERENCES "CreatorWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkComment" ADD CONSTRAINT "WorkComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodePurchase" ADD CONSTRAINT "EpisodePurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodePurchase" ADD CONSTRAINT "EpisodePurchase_workId_fkey" FOREIGN KEY ("workId") REFERENCES "CreatorWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodePurchase" ADD CONSTRAINT "EpisodePurchase_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "CreatorEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinAccount" ADD CONSTRAINT "CoinAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinLedger" ADD CONSTRAINT "CoinLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorRevenueLedger" ADD CONSTRAINT "CreatorRevenueLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
