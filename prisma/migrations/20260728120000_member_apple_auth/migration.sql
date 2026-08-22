ALTER TYPE "MemberAuthProvider" ADD VALUE IF NOT EXISTS 'apple';

ALTER TABLE "MemberAuthIdentity"
ADD COLUMN "applePrivateRelayConsentAt" TIMESTAMP(3);
