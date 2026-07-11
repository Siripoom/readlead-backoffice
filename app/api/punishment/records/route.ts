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
  const body = await request.json() as { id?: string; status?: 'cancelled'|'active' }
  if (!body.id || !body.status) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  const prisma=getPrisma(), record=await prisma.punishmentRecord.update({where:{id:body.id},data:{status:body.status}})
  await prisma.auditLog.create({data:{adminId:auth.admin.id,action:`punishment.${body.status}`,entity:'PunishmentRecord',entityId:record.id}})
  return NextResponse.json(record)
}
