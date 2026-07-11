export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMonthlyIncome } from '@/lib/db/finance'
import { authorizeApi } from '@/lib/auth'

export async function GET() {
  const auth = await authorizeApi('finance'); if (!auth.ok) return auth.response
  const income = await getMonthlyIncome()
  return NextResponse.json(income)
}
