import { getPrisma } from '@/lib/prisma'
import { getWalletChannel, type Platform, type WalletChannel, WALLET_CHANNELS } from '@/lib/wallet-channels'

export class PaymentChannelSettingError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'PaymentChannelSettingError'
  }
}

export type PaymentChannelSettingDto = WalletChannel & {
  platform: Platform
  configuredEnabled: boolean
  enabled: boolean
  ready: boolean
  readinessReason: string | null
}

function missingEnv(keys: string[]) {
  return keys.filter((key) => !process.env[key]?.trim())
}

const GATEWAY_REQUIREMENTS: Record<Extract<WalletChannel, { kind: 'gateway' }>['instrument'], string[]> = {
  promptpay: ['OMISE_SECRET_KEY'],
  shopeepay: ['OMISE_SECRET_KEY'],
  truemoney: ['OMISE_SECRET_KEY', 'WEB_APP_URL'],
  card: ['OMISE_SECRET_KEY', 'WEB_OMISE_PUBLIC_KEY', 'WEB_APP_URL'],
  'apple-pay': ['OMISE_SECRET_KEY', 'WEB_OMISE_PUBLIC_KEY', 'WEB_APP_URL', 'APPLE_PAY_MERCHANT_ID', 'APPLE_PAY_MERCHANT_CERT', 'APPLE_PAY_MERCHANT_KEY', 'WEB_APPLE_PAY_MERCHANT_ID'],
  'google-pay': ['OMISE_SECRET_KEY', 'WEB_OMISE_PUBLIC_KEY', 'WEB_APP_URL'],
}

export function getPaymentChannelReadiness(channel: WalletChannel, platform: Platform) {
  if (platform !== 'web') {
    return { ready: false, reason: 'แอปมือถือยังไม่เชื่อมต่อช่องทางชำระเงินนี้' }
  }
  if (channel.kind === 'iap') {
    return { ready: false, reason: 'ระบบ In-App Purchase ยังไม่เชื่อมต่อ' }
  }
  if (channel.kind === 'slip') {
    const missing = missingEnv(['B2_REGION', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APP_KEY'])
    return missing.length
      ? { ready: false, reason: `ยังไม่ได้ตั้งค่า ${missing.join(', ')}` }
      : { ready: true, reason: null }
  }

  const missing = missingEnv(GATEWAY_REQUIREMENTS[channel.instrument])
  if (channel.instrument === 'google-pay' && process.env.WEB_OMISE_PUBLIC_KEY?.startsWith('pkey_live_')) {
    missing.push(...missingEnv(['WEB_GOOGLE_PAY_MERCHANT_ID']))
  }
  const uniqueMissing = [...new Set(missing)]
  return uniqueMissing.length
    ? { ready: false, reason: `ยังไม่ได้ตั้งค่า ${uniqueMissing.join(', ')}` }
    : { ready: true, reason: null }
}

export function getPublicPaymentConfig() {
  return {
    omisePublicKey: process.env.WEB_OMISE_PUBLIC_KEY?.trim() || '',
    applePayMerchantId: process.env.WEB_APPLE_PAY_MERCHANT_ID?.trim() || '',
    googlePayMerchantId: process.env.WEB_GOOGLE_PAY_MERCHANT_ID?.trim() || '',
  }
}

function settingKey(channelId: string, platform: Platform) {
  return `${channelId}:${platform}`
}

export async function ensurePaymentChannelSettingsInitialized() {
  const prisma = getPrisma()
  const stored = await prisma.paymentChannelSetting.findMany()
  const storedKeys = new Set(stored.map((item) => settingKey(item.channelId, item.platform)))
  const missing = WALLET_CHANNELS.flatMap((channel) => channel.platforms
    .filter((platform) => !storedKeys.has(settingKey(channel.id, platform)))
    .map((platform) => ({
      channelId: channel.id,
      platform,
      enabled: channel.defaultEnabled && getPaymentChannelReadiness(channel, platform).ready,
    })))
  if (missing.length) {
    await prisma.$transaction(async (transaction) => {
      const inserted = await transaction.paymentChannelSetting.createMany({ data: missing, skipDuplicates: true })
      if (inserted.count) {
        await transaction.auditLog.create({
          data: {
            action: 'finance.payment_channels_initialized',
            entity: 'PaymentChannelSetting',
            detail: { insertedCount: inserted.count },
          },
        })
      }
    })
  }
}

export async function listPaymentChannelSettings(): Promise<PaymentChannelSettingDto[]> {
  const stored = await getPrisma().paymentChannelSetting.findMany()
  const byKey = new Map(stored.map((item) => [settingKey(item.channelId, item.platform as Platform), item.enabled]))

  return WALLET_CHANNELS.flatMap((channel) => channel.platforms.map((platform) => {
    const readiness = getPaymentChannelReadiness(channel, platform)
    const configuredEnabled = byKey.get(settingKey(channel.id, platform)) ?? false
    return {
      ...channel,
      platform,
      configuredEnabled,
      enabled: configuredEnabled && readiness.ready,
      ready: readiness.ready,
      readinessReason: readiness.reason,
    }
  }))
}

export async function getEnabledWalletChannels(platform: Platform) {
  await ensurePaymentChannelSettingsInitialized()
  const settings = await listPaymentChannelSettings()
  return settings
    .filter((channel) => channel.platform === platform && channel.enabled)
    .map((channel) => {
      const common = {
        id: channel.id,
        label: channel.label,
        description: channel.description,
        kind: channel.kind,
        platforms: channel.platforms,
        enabled: true as const,
      }
      if (channel.kind === 'gateway') return { ...common, kind: channel.kind, provider: channel.provider, instrument: channel.instrument }
      if (channel.kind === 'iap') return { ...common, kind: channel.kind, store: channel.store }
      return { ...common, kind: channel.kind }
    })
}

export async function isPaymentChannelEnabled(channelId: string, platform: Platform) {
  await ensurePaymentChannelSettingsInitialized()
  const channels = await listPaymentChannelSettings()
  return channels.some((channel) => channel.id === channelId && channel.platform === platform && channel.enabled)
}

export async function requirePaymentChannelEnabled<TError extends Error>(
  channelId: string,
  platform: Platform,
  errorFactory?: (message: string) => TError,
) {
  if (!await isPaymentChannelEnabled(channelId, platform)) {
    const message = 'ช่องทางชำระเงินนี้ปิดให้บริการชั่วคราว'
    throw errorFactory ? errorFactory(message) : new PaymentChannelSettingError(409, message)
  }
}

export async function updatePaymentChannelSetting(input: {
  channelId: string
  platform: Platform
  enabled: boolean
  adminId: string
}) {
  const channel = getWalletChannel(input.channelId)
  if (!channel || !channel.platforms.includes(input.platform)) {
    throw new PaymentChannelSettingError(400, 'ไม่พบช่องทางชำระเงินหรือแพลตฟอร์มที่ระบุ')
  }
  const readiness = getPaymentChannelReadiness(channel, input.platform)
  if (input.enabled && !readiness.ready) {
    throw new PaymentChannelSettingError(409, readiness.reason || 'ผู้ให้บริการยังไม่พร้อมใช้งาน')
  }

  await ensurePaymentChannelSettingsInitialized()

  await getPrisma().$transaction(async (transaction) => {
    await transaction.paymentChannelSetting.upsert({
      where: { channelId_platform: { channelId: input.channelId, platform: input.platform } },
      create: { channelId: input.channelId, platform: input.platform, enabled: input.enabled },
      update: { enabled: input.enabled },
    })
    await transaction.auditLog.create({
      data: {
        adminId: input.adminId,
        action: `finance.payment_channel_${input.enabled ? 'enabled' : 'disabled'}`,
        entity: 'PaymentChannelSetting',
        entityId: settingKey(input.channelId, input.platform),
        detail: { channelId: input.channelId, platform: input.platform, enabled: input.enabled },
      },
    })
  })

  return (await listPaymentChannelSettings()).find((item) => item.id === input.channelId && item.platform === input.platform)!
}
