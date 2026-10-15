CREATE TABLE "WriterApplicationRevision" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicantType" "WriterApplicantType" NOT NULL,
    "penName" TEXT NOT NULL,
    "status" "WriterApplicationStatus" NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "identityObjectKey" TEXT NOT NULL,
    "identityContentType" TEXT NOT NULL,
    "bankObjectKey" TEXT NOT NULL,
    "bankContentType" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WriterApplicationRevision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WriterApplicationRevision_applicationId_archivedAt_idx" ON "WriterApplicationRevision"("applicationId", "archivedAt");
CREATE INDEX "WriterApplicationRevision_expiresAt_idx" ON "WriterApplicationRevision"("expiresAt");
