ALTER TABLE "WithdrawalRequest" ADD COLUMN "clientRequestKey" TEXT;
CREATE UNIQUE INDEX "WithdrawalRequest_userId_clientRequestKey_key" ON "WithdrawalRequest"("userId", "clientRequestKey");
