export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getReportById, updateReportStatus } from '@/lib/db/reports'
import type { ReportStatus } from '@/lib/generated/prisma/enums'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await authorizeApi('reports'); if (!auth.ok) return auth.response
  const { id } = await params
  const report = await getReportById(id)
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(report)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await authorizeApi('reports'); if (!auth.ok) return auth.response
  const { id } = await params
  const body = await request.json() as { status?: ReportStatus }
  if (!body.status || !(['open', 'in_progress', 'resolved'] as const).includes(body.status)) {
    return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 })
  }
  const report = await updateReportStatus(id, body.status)
  return NextResponse.json(report)
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await authorizeApi('reports'); if (!auth.ok) return auth.response
  const { id } = await params
  const body = await request.json() as { message?: string }
  const reply = body.message?.trim() ?? ''
  if (!reply || reply.length > 1000) return NextResponse.json({ error: 'กรุณาพิมพ์ข้อความไม่เกิน 1,000 ตัวอักษร' }, { status: 400 })
  const prisma = getPrisma()
  const existing = await prisma.report.findUnique({ where: { id }, select: { status: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status === 'resolved') return NextResponse.json({ error: 'รายการนี้ได้รับการแก้ไขแล้ว' }, { status: 409 })
  const result = await prisma.$transaction(async tx => {
    const message = await tx.reportMessage.create({ data: { reportId: id, senderType: 'admin', senderName: auth.admin.userId, message: reply } })
    const report = await tx.report.update({ where: { id }, data: { status: 'in_progress' } })
    await tx.auditLog.create({ data: { adminId: auth.admin.id, action: 'report.reply', entity: 'Report', entityId: id } })
    return { message, report }
  })
  return NextResponse.json(result, { status: 201 })
}
