CREATE TYPE "CreatorNarrationType" AS ENUM ('human', 'ai');

ALTER TABLE "CreatorWork"
ADD COLUMN "narrationType" "CreatorNarrationType";

UPDATE "CreatorWork"
SET "narrationType" = 'human'
WHERE "type" = 'audiobook';
