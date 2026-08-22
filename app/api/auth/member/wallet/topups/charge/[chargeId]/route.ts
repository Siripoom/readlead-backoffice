export const dynamic = 'force-dynamic'

import { authorizeMember, privateJson } from '@/lib/creator-api'
import { getMemberCharge } from '@/lib/member-topup-charges'

type Context = { params: Promise<{ chargeId: string }> }

export async function GET(_request: Request, context: Context) {
  const auth = await authorizeMember()
  if (!auth.ok) return auth.response
  const { chargeId } = await context.params
  const charge = await getMemberCharge(auth.user.id, chargeId)
  if (!charge) return privateJson({ error: 'ไม่พบรายการชำระเงิน' }, 404)
  return privateJson({ charge })
}
