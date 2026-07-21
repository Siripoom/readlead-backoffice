export const dynamic = 'force-dynamic'

import { authorizeMember, creatorApiError, privateJson } from '@/lib/creator-api'
import { getTextToSpeechAccess, purchaseTextToSpeech } from '@/lib/db/creator-interactions'
import { getMemberSessionUser } from '@/lib/member-auth'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const user = await getMemberSessionUser()
  try {
    return privateJson(await getTextToSpeechAccess(user?.id, (await context.params).id))
  } catch (error) {
    return creatorApiError(error, 'ตรวจสอบสิทธิ์อ่านออกเสียงไม่สำเร็จ')
  }
}

export async function POST(_request: Request, context: Context) {
  const auth = await authorizeMember()
  if (!auth.ok) return auth.response
  try {
    return privateJson(await purchaseTextToSpeech(auth.user.id, (await context.params).id))
  } catch (error) {
    return creatorApiError(error, 'ซื้อฟีเจอร์อ่านออกเสียงไม่สำเร็จ')
  }
}
