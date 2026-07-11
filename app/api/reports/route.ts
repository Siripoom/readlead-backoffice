export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getReports } from '@/lib/db/reports'
import { authorizeApi } from '@/lib/auth'

export async function GET() {
  const auth = await authorizeApi('reports'); if (!auth.ok) return auth.response
  const reports = await getReports()
  return NextResponse.json(reports)
}
