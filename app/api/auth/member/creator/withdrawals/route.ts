export const dynamic = 'force-dynamic'

import { authorizeMember, creatorApiError, privateJson } from '@/lib/creator-api'
import { createWithdrawal, listCreatorWithdrawals } from '@/lib/db/creator-studio'

export async function GET() {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  try { return privateJson({ items: await listCreatorWithdrawals(auth.user.id) }) } catch (error) { return creatorApiError(error) }
}

export async function POST(request: Request) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({})) as { amount?: number }
  try { return privateJson({ withdrawal: await createWithdrawal(auth.user.id, Number(body.amount)) }, 201) } catch (error) { return creatorApiError(error, 'ส่งคำขอถอนเงินไม่สำเร็จ') }
}
