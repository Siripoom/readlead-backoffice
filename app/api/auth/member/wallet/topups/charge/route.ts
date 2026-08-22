export const dynamic = 'force-dynamic'

import { authorizeMember, privateJson } from '@/lib/creator-api'
import { createMemberCharge, MemberChargeError } from '@/lib/member-topup-charges'

export async function POST(request: Request) {
  const auth = await authorizeMember()
  if (!auth.ok) return auth.response
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return privateJson({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400)
  }
  try {
    const result = await createMemberCharge(
      auth.user.id,
      body as { packageId?: unknown; channelId?: unknown; omiseToken?: unknown; mobileNumber?: unknown },
      request.headers.get('idempotency-key'),
    )
    return privateJson({ charge: result.charge }, result.idempotent ? 200 : 201)
  } catch (error) {
    if (error instanceof MemberChargeError) return privateJson({ error: error.message }, error.status)
    console.error('Member charge creation failed', error)
    return privateJson({ error: 'ทำรายการชำระเงินไม่สำเร็จ กรุณาลองใหม่' }, 500)
  }
}
