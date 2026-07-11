export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createPunishmentLevel, getPunishmentLevels, updatePunishmentLevel } from '@/lib/db/punishment'
import { authorizeApi } from '@/lib/auth'

export async function GET() {
  const auth = await authorizeApi('punishment'); if (!auth.ok) return auth.response
  const levels = await getPunishmentLevels()
  return NextResponse.json(levels)
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApi('punishment'); if (!auth.ok) return auth.response
  const body = await request.json() as { level: number; name: string; threshold: number; duration: number }
  const level = await createPunishmentLevel(body)
  return NextResponse.json(level, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeApi('punishment'); if (!auth.ok) return auth.response
  const body = await request.json() as { id: string; name?: string; threshold?: number; duration?: number }
  const { id, ...data } = body
  const level = await updatePunishmentLevel(id, data)
  return NextResponse.json(level)
}
