import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

const admin = { id: 'admin-finance', isOwner: false, permissions: ['finance'] }
const settingCalls: unknown[] = []
const auditCalls: unknown[] = []
const permissionCalls: Array<string | undefined> = []
let storedSettings: Array<{ channelId: string; platform: string; enabled: boolean }> = []

const prisma = {
  paymentChannelSetting: {
    findMany: async () => storedSettings,
    createMany: async ({ data }: { data: Array<{ channelId: string; platform: string; enabled: boolean }> }) => {
      let count = 0
      for (const item of data) {
        if (!storedSettings.some((stored) => stored.channelId === item.channelId && stored.platform === item.platform)) {
          storedSettings.push(item)
          count += 1
        }
      }
      return { count }
    },
    upsert: async (args: { where: { channelId_platform: { channelId: string; platform: string } }; create: { channelId: string; platform: string; enabled: boolean }; update: { enabled: boolean } }) => {
      settingCalls.push(args)
      const index = storedSettings.findIndex((item) => item.channelId === args.where.channelId_platform.channelId && item.platform === args.where.channelId_platform.platform)
      if (index >= 0) storedSettings[index] = { ...storedSettings[index]!, enabled: args.update.enabled }
      else storedSettings.push(args.create)
      return args
    },
  },
  auditLog: {
    create: async (args: unknown) => { auditCalls.push(args); return args },
  },
  $transaction: async <T>(callback: (transaction: typeof prisma) => Promise<T>) => callback(prisma),
}

mock.module('@/lib/auth', {
  exports: { authorizeApi: async (permission?: string) => { permissionCalls.push(permission); return { ok: true as const, admin } } },
})
mock.module('@/lib/prisma', {
  exports: { getPrisma: () => prisma },
})

const settings = await import('../lib/payment-channel-settings')
const route = await import('../app/api/finance/payment-channels/route')

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/finance/payment-channels', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test.beforeEach(() => {
  settingCalls.length = 0
  auditCalls.length = 0
  permissionCalls.length = 0
  storedSettings = []
  process.env.OMISE_SECRET_KEY = 'skey_test_ready'
  process.env.WEB_OMISE_PUBLIC_KEY = 'pkey_test_ready'
})

test.after(() => {
  delete process.env.OMISE_SECRET_KEY
  delete process.env.WEB_OMISE_PUBLIC_KEY
})

test('GET returns effective channel settings for every supported platform', async () => {
  const response = await route.GET()
  assert.equal(response.status, 200)
  const body = await response.json() as { channels: Array<{ id: string; platform: string; enabled: boolean; ready: boolean }> }
  assert.deepEqual(permissionCalls, ['finance'])
  assert.ok(body.channels.some((channel) => channel.id === 'promptpay' && channel.platform === 'web'))
  assert.ok(body.channels.some((channel) => channel.id === 'app-store' && channel.platform === 'ios'))
})

test('PATCH validates the catalog identity and platform', async () => {
  const response = await route.PATCH(patchRequest({ channelId: 'made-up', platform: 'web', enabled: true }))
  assert.equal(response.status, 400)
  assert.equal(settingCalls.length, 0)
})

test('PATCH refuses to enable a provider that is not ready', async () => {
  delete process.env.OMISE_SECRET_KEY
  const response = await route.PATCH(patchRequest({ channelId: 'promptpay', platform: 'web', enabled: true }))
  assert.equal(response.status, 409)
  const body = await response.json() as { error: string }
  assert.match(body.error, /OMISE_SECRET_KEY/)
  assert.equal(settingCalls.length, 0)
})

test('PATCH persists availability and audit log in one transaction', async () => {
  const response = await route.PATCH(patchRequest({ channelId: 'promptpay', platform: 'web', enabled: false }))
  assert.equal(response.status, 200)
  assert.equal(settingCalls.length, 1)
  assert.deepEqual(auditCalls.filter((call) => (call as { data: { action: string } }).data.action === 'finance.payment_channel_disabled'), [{
    data: {
      adminId: admin.id,
      action: 'finance.payment_channel_disabled',
      entity: 'PaymentChannelSetting',
      entityId: 'promptpay:web',
      detail: { channelId: 'promptpay', platform: 'web', enabled: false },
    },
  }])
})

test('effective member channels hide disabled entries', async () => {
  storedSettings = [{ channelId: 'promptpay', platform: 'web', enabled: false }]
  const channels = await settings.getEnabledWalletChannels('web')
  assert.equal(channels.some((channel) => channel.id === 'promptpay'), false)
  assert.ok(channels.every((channel) => channel.enabled && channel.platforms.includes('web')))
})

test('new payment attempts receive 409 when the selected channel is disabled', async () => {
  storedSettings = [{ channelId: 'promptpay', platform: 'web', enabled: false }]
  await assert.rejects(
    () => settings.requirePaymentChannelEnabled('promptpay', 'web'),
    (error: unknown) => error instanceof settings.PaymentChannelSettingError
      && error.status === 409
      && /ปิดให้บริการ/.test(error.message),
  )
})

test('bootstrap stores an unready legacy channel as disabled and does not auto-enable it later', async () => {
  delete process.env.OMISE_SECRET_KEY
  await settings.ensurePaymentChannelSettingsInitialized()
  assert.equal(storedSettings.find((item) => item.channelId === 'promptpay' && item.platform === 'web')?.enabled, false)
  process.env.OMISE_SECRET_KEY = 'skey_test_ready'
  const channels = await settings.listPaymentChannelSettings()
  assert.equal(channels.find((item) => item.id === 'promptpay' && item.platform === 'web')?.configuredEnabled, false)
})

test('bootstrap preserves Apple Pay enabled when its full configuration is ready', async () => {
  process.env.WEB_APP_URL = 'https://readlead.example'
  process.env.APPLE_PAY_MERCHANT_ID = 'merchant.example'
  process.env.APPLE_PAY_MERCHANT_CERT = 'cert'
  process.env.APPLE_PAY_MERCHANT_KEY = 'key'
  process.env.WEB_APPLE_PAY_MERCHANT_ID = 'merchant.example'
  await settings.ensurePaymentChannelSettingsInitialized()
  const channels = await settings.listPaymentChannelSettings()
  assert.equal(channels.find((item) => item.id === 'apple-pay' && item.platform === 'web')?.configuredEnabled, true)
  delete process.env.WEB_APP_URL
  delete process.env.APPLE_PAY_MERCHANT_ID
  delete process.env.APPLE_PAY_MERCHANT_CERT
  delete process.env.APPLE_PAY_MERCHANT_KEY
  delete process.env.WEB_APPLE_PAY_MERCHANT_ID
})
