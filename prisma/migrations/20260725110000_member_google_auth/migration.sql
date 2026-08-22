CREATE TYPE "MemberAuthProvider" AS ENUM ('google');

CREATE TABLE "MemberAuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "MemberAuthProvider" NOT NULL,
    "providerUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberAuthIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberAuthIdentity_provider_providerUid_key"
ON "MemberAuthIdentity"("provider", "providerUid");

CREATE UNIQUE INDEX "MemberAuthIdentity_userId_provider_key"
ON "MemberAuthIdentity"("userId", "provider");

CREATE INDEX "MemberAuthIdentity_userId_idx"
ON "MemberAuthIdentity"("userId");

ALTER TABLE "MemberAuthIdentity"
ADD CONSTRAINT "MemberAuthIdentity_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
