export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getWithdrawalRequests, updateWithdrawalStatus } from '@/lib/db/finance'
import type { WithdrawalStatus } from '@/lib/generated/prisma/enums'

export async function GET() {
  const withdrawals = await getWithdrawalRequests()
  return NextResponse.json(withdrawals)
}

export async function PATCH(request: NextRequest) {
  const body = await request.json() as { id: string; status: WithdrawalStatus }
  const withdrawal = await updateWithdrawalStatus(body.id, body.status)
  return NextResponse.json(withdrawal)
}
