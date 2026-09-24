-- CreateTable
CREATE TYPE "PaymentPlatform" AS ENUM ('web', 'ios', 'android');

CREATE TABLE "PaymentChannelSetting" (
    "channelId" TEXT NOT NULL,
    "platform" "PaymentPlatform" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentChannelSetting_pkey" PRIMARY KEY ("channelId","platform")
);

CREATE INDEX "PaymentChannelSetting_platform_enabled_idx" ON "PaymentChannelSetting"("platform", "enabled");
