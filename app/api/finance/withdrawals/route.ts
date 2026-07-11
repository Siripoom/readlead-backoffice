export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getWithdrawalRequests, updateWithdrawalStatus } from '@/lib/db/finance'
import type { WithdrawalStatus } from '@/lib/generated/prisma/enums'
import { authorizeApi } from '@/lib/auth'

export async function GET() {
  const auth = await authorizeApi('finance'); if (!auth.ok) return auth.response
  const withdrawals = await getWithdrawalRequests()
  return NextResponse.json(withdrawals)
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeApi('finance'); if (!auth.ok) return auth.response
  const body = await request.json() as { id: string; status: WithdrawalStatus; note?: string }
  const withdrawal = await updateWithdrawalStatus(body.id, body.status, auth.admin.user.name, body.note)
  return NextResponse.json(withdrawal)
}
