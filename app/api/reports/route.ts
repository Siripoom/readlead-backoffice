import { NextResponse } from 'next/server'
import { getReports } from '@/lib/db/reports'

export async function GET() {
  const reports = await getReports()
  return NextResponse.json(reports)
}
