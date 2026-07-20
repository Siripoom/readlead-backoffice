CREATE TYPE "WriterApplicantType" AS ENUM ('person', 'company');
CREATE TYPE "WriterApplicationStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "WriterApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "applicantType" "WriterApplicantType" NOT NULL,
  "penName" TEXT NOT NULL,
  "status" "WriterApplicationStatus" NOT NULL DEFAULT 'pending',
  "encryptedPayload" TEXT NOT NULL,
  "identityObjectKey" TEXT NOT NULL,
  "identityContentType" TEXT NOT NULL,
  "bankObjectKey" TEXT NOT NULL,
  "bankContentType" TEXT NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WriterApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WriterApplication_userId_key" ON "WriterApplication"("userId");
CREATE INDEX "WriterApplication_status_submittedAt_idx" ON "WriterApplication"("status", "submittedAt");

ALTER TABLE "WriterApplication"
ADD CONSTRAINT "WriterApplication_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
