ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'account_security';
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'payment';
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'content';
ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'feedback';

ALTER TABLE "Report" ADD COLUMN "isSupport" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ReportAttachment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "messageId" TEXT,
    "objectKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportAttachment_objectKey_key" ON "ReportAttachment"("objectKey");
CREATE INDEX "ReportAttachment_reportId_createdAt_idx" ON "ReportAttachment"("reportId", "createdAt");
CREATE INDEX "ReportAttachment_messageId_idx" ON "ReportAttachment"("messageId");
ALTER TABLE "ReportAttachment" ADD CONSTRAINT "ReportAttachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportAttachment" ADD CONSTRAINT "ReportAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ReportMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
