ALTER TABLE "TicketLedger" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "TicketLedger_idempotencyKey_key" ON "TicketLedger"("idempotencyKey");
