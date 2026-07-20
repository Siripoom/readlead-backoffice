-- Creator work publication now has a separate approval state. Existing published
-- works remain published and are not sent back through moderation.
ALTER TYPE "CreatorWorkStatus" ADD VALUE IF NOT EXISTS 'approved' BEFORE 'published';
ALTER TYPE "CreatorModerationType" ADD VALUE IF NOT EXISTS 'publication' BEFORE 'translation';

ALTER TABLE "CreatorWork" ADD COLUMN "approvedAt" TIMESTAMP(3);

-- Repair legacy pending works that were created before every publication had a
-- moderation request. Existing translation requests are preserved.
INSERT INTO "CreatorModerationRequest" (
  "id",
  "workId",
  "type",
  "status",
  "submittedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'publication_' || md5(w."id" || clock_timestamp()::text),
  w."id",
  'publication'::"CreatorModerationType",
  'pending'::"CreatorModerationStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CreatorWork" w
WHERE w."status" = 'pending_review'
  AND NOT EXISTS (
    SELECT 1
    FROM "CreatorModerationRequest" r
    WHERE r."workId" = w."id" AND r."status" = 'pending'
  );
