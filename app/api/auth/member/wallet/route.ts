export const dynamic = 'force-dynamic'

import { authorizeMember, privateJson } from '@/lib/creator-api'
import { getMemberWallet } from '@/lib/member-wallet'

export async function GET() {
  const auth = await authorizeMember()
  if (!auth.ok) return auth.response
  return privateJson(await getMemberWallet(auth.user.id))
}
