export const dynamic = 'force-dynamic'

import { authorizeApi } from '@/lib/auth'
import {
  ensurePaymentChannelSettingsInitialized,
  listPaymentChannelSettings,
  PaymentChannelSettingError,
  updatePaymentChannelSetting,
} from '@/lib/payment-channel-settings'
import type { Platform } from '@/lib/wallet-channels'

export async function GET() {
  const auth = await authorizeApi('finance')
  if (!auth.ok) return auth.response
  await ensurePaymentChannelSettingsInitialized()
  return Response.json({ channels: await listPaymentChannelSettings() })
}

export async function PATCH(request: Request) {
  const auth = await authorizeApi('finance')
  if (!auth.ok) return auth.response
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') return Response.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 })
  const input = body as { channelId?: unknown; platform?: unknown; enabled?: unknown }
  if (typeof input.channelId !== 'string' || !['web', 'ios', 'android'].includes(String(input.platform)) || typeof input.enabled !== 'boolean') {
    return Response.json({ error: 'ข้อมูลช่องทางชำระเงินไม่ถูกต้อง' }, { status: 400 })
  }

  try {
    const channel = await updatePaymentChannelSetting({
      channelId: input.channelId,
      platform: input.platform as Platform,
      enabled: input.enabled,
      adminId: auth.admin.id,
    })
    return Response.json({ channel })
  } catch (error) {
    if (error instanceof PaymentChannelSettingError) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    console.error('Payment channel setting update failed', error)
    return Response.json({ error: 'บันทึกช่องทางชำระเงินไม่สำเร็จ' }, { status: 500 })
  }
}
