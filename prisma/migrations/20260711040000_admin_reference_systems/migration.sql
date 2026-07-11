-- Extend existing records without dropping data.
ALTER TABLE "CreatorProfile" ADD COLUMN "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "AdminProfile" ADD COLUMN "adminCode" TEXT,
ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "AdminProfile_adminCode_key" ON "AdminProfile"("adminCode");
ALTER TABLE "PunishmentRecord" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active', ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE TABLE "AdminSession" (
  "id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "adminId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL, "adminId" TEXT, "action" TEXT NOT NULL, "entity" TEXT NOT NULL,
  "entityId" TEXT, "detail" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReportMessage" (
  "id" TEXT NOT NULL, "reportId" TEXT NOT NULL, "senderType" TEXT NOT NULL, "senderName" TEXT NOT NULL,
  "message" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReportMessage_reportId_createdAt_idx" ON "ReportMessage"("reportId", "createdAt");
ALTER TABLE "ReportMessage" ADD CONSTRAINT "ReportMessage_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WithdrawalHistory" (
  "id" TEXT NOT NULL, "withdrawalId" TEXT NOT NULL, "status" "WithdrawalStatus" NOT NULL,
  "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WithdrawalHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WithdrawalHistory_withdrawalId_createdAt_idx" ON "WithdrawalHistory"("withdrawalId", "createdAt");
ALTER TABLE "WithdrawalHistory" ADD CONSTRAINT "WithdrawalHistory_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WithdrawalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CmsPage" (
  "id" TEXT NOT NULL, "slug" TEXT NOT NULL, "label" TEXT NOT NULL, "slideSeconds" INTEGER NOT NULL DEFAULT 5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CmsPage_slug_key" ON "CmsPage"("slug");
CREATE TABLE "CmsSection" (
  "id" TEXT NOT NULL, "pageId" TEXT NOT NULL, "key" TEXT NOT NULL, "title" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "sortOrder" INTEGER NOT NULL DEFAULT 0, "config" JSONB,
  CONSTRAINT "CmsSection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CmsSection_pageId_key_key" ON "CmsSection"("pageId", "key");
CREATE INDEX "CmsSection_pageId_sortOrder_idx" ON "CmsSection"("pageId", "sortOrder");
ALTER TABLE "CmsSection" ADD CONSTRAINT "CmsSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "CmsPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "CmsItem" (
  "id" TEXT NOT NULL, "sectionId" TEXT NOT NULL, "title" TEXT NOT NULL, "subtitle" TEXT,
  "imageUrl" TEXT, "linkUrl" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "config" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CmsItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CmsItem_sectionId_sortOrder_idx" ON "CmsItem"("sectionId", "sortOrder");
ALTER TABLE "CmsItem" ADD CONSTRAINT "CmsItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CmsSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ModerationQueue" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "creatorName" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "chapter" TEXT, "status" TEXT NOT NULL DEFAULT 'pending', "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ModerationQueue_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IpBlacklist" (
  "id" TEXT NOT NULL, "term" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IpBlacklist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IpBlacklist_term_key" ON "IpBlacklist"("term");

CREATE TABLE "ExpAccount" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "balance" INTEGER NOT NULL DEFAULT 0, "level" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ExpAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExpAccount_userId_key" ON "ExpAccount"("userId");
ALTER TABLE "ExpAccount" ADD CONSTRAINT "ExpAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "ExpLedger" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "amount" INTEGER NOT NULL, "action" TEXT NOT NULL, "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'granted', "reason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExpLedger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExpLedger_userId_createdAt_idx" ON "ExpLedger"("userId", "createdAt");
CREATE INDEX "ExpLedger_status_createdAt_idx" ON "ExpLedger"("status", "createdAt");
ALTER TABLE "ExpLedger" ADD CONSTRAINT "ExpLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "TicketLedger" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "amount" INTEGER NOT NULL, "type" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "referenceId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketLedger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TicketLedger_userId_createdAt_idx" ON "TicketLedger"("userId", "createdAt");
ALTER TABLE "TicketLedger" ADD CONSTRAINT "TicketLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
