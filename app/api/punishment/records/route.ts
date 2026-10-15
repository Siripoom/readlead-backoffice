export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPunishmentRecords } from '@/lib/db/punishment'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

export async function GET() {
  const auth = await authorizeApi('punishment'); if (!auth.ok) return auth.response
  const records = await getPunishmentRecords()
  return NextResponse.json(records)
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApi('punishment'); if (!auth.ok) return auth.response
  const body = await request.json() as { userId?: string; levelId?: string; note?: string }
  if (!body.userId || !body.levelId || !body.note?.trim()) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  const prisma = getPrisma()
  const [user, level] = await Promise.all([
    prisma.user.findFirst({ where: { id: body.userId, userType: { not: 'admin' } }, select: { id: true, name: true, email: true } }),
    prisma.punishmentLevel.findUnique({ where: { id: body.levelId } }),
  ])
  if (!user || !level) return NextResponse.json({ error: 'ไม่พบผู้ใช้หรือระดับโทษ' }, { status: 404 })
  const date = new Date()
  const expiresAt = level.duration > 0 ? new Date(date.getTime() + level.duration * 86_400_000) : null
  const record = await prisma.punishmentRecord.create({ data: { userId: user.id, levelName: level.name, note: body.note.trim(), date, expiresAt, status: level.level === 1 ? 'recorded' : 'active' }, include: { user: { select: { name: true, email: true } } } })
  await prisma.auditLog.create({ data: { adminId: auth.admin.id, action: 'punishment.created', entity: 'PunishmentRecord', entityId: record.id, detail: { levelId: level.id, userId: user.id } } })
  return NextResponse.json(record, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeApi('punishment'); if (!auth.ok) return auth.response
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  const { id, status } = body as Record<string, unknown>
  if (typeof id !== 'string' || !id.trim() || (status !== 'cancelled' && status !== 'active')) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  const prisma = getPrisma()
  let record
  try {
    record = await prisma.punishmentRecord.update({ where: { id }, data: { status } })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'ไม่พบรายการบทลงโทษ' }, { status: 404 })
    }
    throw error
  }
  await prisma.auditLog.create({data:{adminId:auth.admin.id,action:`punishment.${status}`,entity:'PunishmentRecord',entityId:record.id}})
  return NextResponse.json(record)
}
