export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUserPunishments } from '@/lib/db/users'
import { createPunishmentRecord } from '@/lib/db/punishment'
import { authorizeApi } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await authorizeApi('users'); if (!auth.ok) return auth.response
  const { id } = await params
  const records = await getUserPunishments(id)
  return NextResponse.json(records)
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await authorizeApi('punishment'); if (!auth.ok) return auth.response
  const { id } = await params
  const body = await request.json() as { levelName: string; note?: string }
  const record = await createPunishmentRecord({ userId: id, ...body })
  return NextResponse.json(record, { status: 201 })
}
