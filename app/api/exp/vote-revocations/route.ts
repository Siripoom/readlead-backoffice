import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import { voteFanTotals } from '@/lib/exp-rules'

export async function POST(request: NextRequest) {
  const auth = await authorizeApi('exp')
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null) as { userId?: string; workId?: string } | null
  if (!body?.userId || !body.workId) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const prisma = getPrisma()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const work = await tx.creatorWork.findUnique({
          where: { id: body.workId },
          select: { id: true, title: true, dailyVotes: true, monthlyVotes: true },
        })
        if (!work) throw new Error('NOT_FOUND')
        const entries = await tx.ticketLedger.findMany({
          where: {
            userId: body.userId,
            referenceId: body.workId,
            type: { in: ['vote_free', 'vote_month', 'tip', 'subscription', 'revoke'] },
          },
          orderBy: { createdAt: 'asc' },
        })
        const totals = voteFanTotals(entries)
        if (totals.fanPoints <= 0) throw new Error('NOTHING_TO_REVOKE')

        await tx.creatorWork.update({
          where: { id: work.id },
          data: {
            dailyVotes: Math.max(0, work.dailyVotes - totals.freeVotes),
            monthlyVotes: Math.max(0, work.monthlyVotes - totals.monthlyVotes),
          },
        })
        const row = await tx.ticketLedger.create({
          data: {
            userId: body.userId!,
            amount: 0,
            type: 'revoke',
            reason: 'แอดมินริบโหวต/แต้มแฟนย้อนหลัง',
            referenceId: body.workId!,
            metadata: { ...totals, workTitle: work.title, adminId: auth.admin.id },
          },
        })
        await tx.auditLog.create({
          data: {
            adminId: auth.admin.id,
            action: 'exp.vote-fan.revoke',
            entity: 'TicketLedger',
            entityId: row.id,
            detail: { userId: body.userId, workId: body.workId, ...totals },
          },
        })
        return totals
      }, { isolationLevel: 'Serializable' })
      return NextResponse.json(result)
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      if (code === 'NOT_FOUND') return NextResponse.json({ error: 'ไม่พบผลงาน' }, { status: 404 })
      if (code === 'NOTHING_TO_REVOKE') return NextResponse.json({ error: 'ไม่มียอดให้ริบแล้ว' }, { status: 409 })
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2034' && attempt < 2) continue
      console.error('Vote/fan revocation failed', error)
      return NextResponse.json({ error: 'ริบโหวต/แต้มไม่สำเร็จ' }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'ข้อมูลถูกเปลี่ยนพร้อมกัน กรุณาลองใหม่' }, { status: 409 })
}
