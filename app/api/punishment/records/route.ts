import { NextResponse } from 'next/server'
import { getPunishmentRecords } from '@/lib/db/punishment'

export async function GET() {
  const records = await getPunishmentRecords()
  return NextResponse.json(records)
}
