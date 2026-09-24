export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPunishmentLevels } from '@/lib/db/punishment'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import { validateCreatePunishmentLevel, validateUpdatePunishmentLevel } from '@/lib/punishment-level-validation'

function isPrismaError(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

export async function GET() {
  const auth = await authorizeApi('punishment'); if (!auth.ok) return auth.response
  const levels = await getPunishmentLevels()
  return NextResponse.json(levels)
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApi('punishment'); if (!auth.ok) return auth.response
  const validation = validateCreatePunishmentLevel(await request.json().catch(() => null))
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })

  const prisma = getPrisma()
  const duplicate = await prisma.punishmentLevel.findUnique({ where: { level: validation.data.level }, select: { id: true } })
  if (duplicate) return NextResponse.json({ error: 'มีหมายเลขระดับโทษนี้แล้ว' }, { status: 409 })

  try {
    const level = await prisma.$transaction(async (transaction) => {
      const created = await transaction.punishmentLevel.create({ data: validation.data })
      await transaction.auditLog.create({
        data: {
          adminId: auth.admin.id,
          action: 'punishment_level.created',
          entity: 'PunishmentLevel',
          entityId: created.id,
          detail: validation.data,
        },
      })
      return created
    })
    return NextResponse.json(level, { status: 201 })
  } catch (error) {
    if (isPrismaError(error, 'P2002')) return NextResponse.json({ error: 'มีหมายเลขระดับโทษนี้แล้ว' }, { status: 409 })
    throw error
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeApi('punishment'); if (!auth.ok) return auth.response
  const validation = validateUpdatePunishmentLevel(await request.json().catch(() => null))
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })

  const prisma = getPrisma()
  const current = await prisma.punishmentLevel.findUnique({ where: { id: validation.data.id } })
  if (!current) return NextResponse.json({ error: 'ไม่พบระดับโทษ' }, { status: 404 })

  const level = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.punishmentLevel.update({ where: { id: current.id }, data: validation.data.data })
    await transaction.auditLog.create({
      data: {
        adminId: auth.admin.id,
        action: 'punishment_level.updated',
        entity: 'PunishmentLevel',
        entityId: current.id,
        detail: {
          previous: { name: current.name, threshold: current.threshold, duration: current.duration },
          changes: validation.data.data,
        },
      },
    })
    return updated
  })
  return NextResponse.json(level)
}
