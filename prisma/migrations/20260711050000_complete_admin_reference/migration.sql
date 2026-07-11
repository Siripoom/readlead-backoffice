ALTER TABLE "WithdrawalRequest"
ADD COLUMN "slipUrl" TEXT,
ADD COLUMN "reviewerName" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);

ALTER TABLE "ExpLedger"
ADD COLUMN "referenceId" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewerName" TEXT,
ADD COLUMN "metadata" JSONB;

ALTER TABLE "TicketLedger"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'completed',
ADD COLUMN "metadata" JSONB;
