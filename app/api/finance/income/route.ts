export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMonthlyIncome } from '@/lib/db/finance'

export async function GET() {
  const income = await getMonthlyIncome()
  return NextResponse.json(income)
}
