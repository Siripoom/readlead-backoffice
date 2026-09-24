export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUserPunishments } from '@/lib/db/users'
import { authorizeApi } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await authorizeApi('users'); if (!auth.ok) return auth.response
  const { id } = await params
  const records = await getUserPunishments(id)
  return NextResponse.json(records)
}
