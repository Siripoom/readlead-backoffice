ALTER TABLE "WorkReview"
ADD COLUMN "recommended" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "spoiler" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "WorkReviewReply" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkReviewReply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkReviewReaction" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkReviewReaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkReviewReply_reviewId_status_createdAt_idx" ON "WorkReviewReply"("reviewId", "status", "createdAt");
CREATE INDEX "WorkReviewReply_userId_createdAt_idx" ON "WorkReviewReply"("userId", "createdAt");
CREATE UNIQUE INDEX "WorkReviewReaction_reviewId_userId_key" ON "WorkReviewReaction"("reviewId", "userId");
CREATE INDEX "WorkReviewReaction_reviewId_kind_idx" ON "WorkReviewReaction"("reviewId", "kind");
CREATE INDEX "WorkReviewReaction_userId_createdAt_idx" ON "WorkReviewReaction"("userId", "createdAt");

ALTER TABLE "WorkReviewReply" ADD CONSTRAINT "WorkReviewReply_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "WorkReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkReviewReply" ADD CONSTRAINT "WorkReviewReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkReviewReaction" ADD CONSTRAINT "WorkReviewReaction_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "WorkReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkReviewReaction" ADD CONSTRAINT "WorkReviewReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreatorWork.reviewCount is a cached aggregate. Repair seed/demo values so it
-- reflects published review rows before the new API starts maintaining it.
UPDATE "CreatorWork" work
SET "reviewCount" = (
  SELECT COUNT(*)::INTEGER
  FROM "WorkReview" review
  WHERE review."workId" = work."id" AND review."status" = 'published'
);
