ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

CREATE TABLE "MemberSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberSession_tokenHash_key" ON "MemberSession"("tokenHash");
CREATE INDEX "MemberSession_userId_idx" ON "MemberSession"("userId");
CREATE INDEX "MemberSession_expiresAt_idx" ON "MemberSession"("expiresAt");

ALTER TABLE "MemberSession"
ADD CONSTRAINT "MemberSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
