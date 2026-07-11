import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

export async function GET() {
  const auth = await authorizeApi('users'); if (!auth.ok) return auth.response
  const prisma = getPrisma()
  const [queue, blacklist] = await Promise.all([
    prisma.moderationQueue.findMany({ orderBy: { submittedAt: 'asc' } }),
    prisma.ipBlacklist.findMany({ orderBy: { createdAt: 'desc' } }),
  ])
  return NextResponse.json({ queue, blacklist })
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApi('users'); if (!auth.ok) return auth.response
  const body = await request.json() as { term?: string }
  const term = body.term?.trim()
  if (!term) return NextResponse.json({ error: 'กรุณาระบุคำที่ต้องการบล็อก' }, { status: 400 })
  const item = await getPrisma().ipBlacklist.upsert({ where: { term }, update: {}, create: { term } })
  return NextResponse.json(item, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeApi('users'); if (!auth.ok) return auth.response
  const body = await request.json() as { id?: string; decision?: 'approved'|'rejected' }
  if (!body.id || !body.decision) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  const prisma = getPrisma()
  const item = await prisma.moderationQueue.update({ where: { id: body.id }, data: { status: body.decision } })
  await prisma.auditLog.create({ data: { adminId: auth.admin.id, action: `moderation.${body.decision}`, entity: 'ModerationQueue', entityId: item.id } })
  return NextResponse.json(item)
}

export async function DELETE(request: NextRequest) {
  const auth = await authorizeApi('users'); if (!auth.ok) return auth.response
  const id = request.nextUrl.searchParams.get('blacklistId')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await getPrisma().ipBlacklist.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
