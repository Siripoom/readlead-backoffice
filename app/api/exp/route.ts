import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import {
  bangkokDayStart,
  buildExpAlerts,
  expActionLabel,
  expProgress,
  levelForExp,
} from '@/lib/exp-rules'

export const dynamic = 'force-dynamic'

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : ''
  if (code === 'NOT_FOUND') return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
  if (code === 'CONFLICT') return NextResponse.json({ error: 'สถานะรายการถูกเปลี่ยนแล้ว' }, { status: 409 })
  console.error('EXP operation failed', error)
  return NextResponse.json({ error: 'ดำเนินการไม่สำเร็จ' }, { status: 500 })
}

export async function GET() {
  const auth = await authorizeApi('exp')
  if (!auth.ok) return auth.response
  const prisma = getPrisma()
  const today = bangkokDayStart()
  const [accounts, ledger] = await Promise.all([
    prisma.expAccount.findMany({
      include: { user: { select: { id: true, name: true, email: true, joinedAt: true } } },
      orderBy: [{ user: { joinedAt: 'desc' } }, { userId: 'asc' }],
    }),
    prisma.expLedger.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const todayEntries = ledger.filter((entry) => entry.createdAt >= today)
  const todayGranted = todayEntries.filter((entry) => entry.status === 'granted' && entry.amount > 0)
  const pending = ledger.filter((entry) => entry.status === 'pending').sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const levelups = todayEntries.filter((entry) => entry.action === '_levelup')
  const grantedToday = todayGranted.reduce((sum, entry) => sum + entry.amount, 0)
  const byAction = new Map<string, number>()
  const byUser = new Map<string, { userId: string; userName: string; amount: number }>()
  for (const entry of todayGranted) {
    byAction.set(entry.action, (byAction.get(entry.action) ?? 0) + entry.amount)
    const current = byUser.get(entry.userId)
    byUser.set(entry.userId, { userId: entry.userId, userName: entry.user.name, amount: (current?.amount ?? 0) + entry.amount })
  }

  const accountRows = accounts.map((account) => {
    const level = expProgress(account.balance)
    return { ...account, level: level.level, levelName: level.name }
  })
  const alerts = buildExpAlerts(
    accounts.map((account) => ({
      userId: account.userId,
      userName: account.user.name,
      joinedAt: account.user.joinedAt,
      balance: account.balance,
    })),
    ledger,
  )

  return NextResponse.json({
    summary: {
      totalUsers: accounts.length,
      grantedToday,
      levelupsToday: levelups.length,
      pendingReviews: pending.length,
    },
    details: {
      expByAction: [...byAction.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([action, amount]) => ({ action, label: expActionLabel(action), amount, percent: grantedToday ? Math.round((amount / grantedToday) * 100) : 0 })),
      topRecipients: [...byUser.values()].sort((a, b) => b.amount - a.amount).slice(0, 5),
      levelups,
      pending,
    },
    accounts: accountRows,
    alerts,
  })
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApi('exp')
  if (!auth.ok) return auth.response
  const prisma = getPrisma()
  const body = await request.json().catch(() => null) as { userId?: string; amount?: number; action?: string; source?: string; reason?: string; pending?: boolean } | null
  if (!body?.userId || !Number.isInteger(body.amount) || body.amount === 0 || !body.action || !body.source) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }
  try {
    const status = body.pending ? 'pending' : 'granted'
    const entry = await prisma.$transaction(async (tx) => {
      const row = await tx.expLedger.create({
        data: { userId: body.userId!, amount: body.amount!, action: body.action!, source: body.source!, reason: body.reason, status },
      })
      if (status === 'granted') {
        const account = await tx.expAccount.findUnique({ where: { userId: body.userId! } })
        if (!account) throw new Error('NOT_FOUND')
        const balance = Math.max(0, account.balance + body.amount!)
        await tx.expAccount.update({ where: { userId: body.userId! }, data: { balance, level: levelForExp(balance).level } })
      }
      await tx.auditLog.create({
        data: { adminId: auth.admin.id, action: 'exp.create', entity: 'ExpLedger', entityId: row.id, detail: { amount: body.amount, status } },
      })
      return row
    })
    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeApi('exp')
  if (!auth.ok) return auth.response
  const prisma = getPrisma()
  const body = await request.json().catch(() => null) as { id?: string; decision?: 'approve' | 'reject' | 'revoke' } | null
  if (!body?.id || !['approve', 'reject', 'revoke'].includes(body.decision ?? '')) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.expLedger.findUnique({ where: { id: body.id } })
      if (!entry) throw new Error('NOT_FOUND')
      const account = await tx.expAccount.findUnique({ where: { userId: entry.userId } })
      if (!account) throw new Error('NOT_FOUND')

      let result
      if (body.decision === 'approve' && entry.status === 'pending') {
        const balance = Math.max(0, account.balance + entry.amount)
        await tx.expAccount.update({ where: { userId: entry.userId }, data: { balance, level: levelForExp(balance).level } })
        result = await tx.expLedger.update({ where: { id: entry.id }, data: { status: 'granted', reviewedAt: new Date(), reviewerName: auth.admin.userId } })
      } else if (body.decision === 'reject' && entry.status === 'pending') {
        result = await tx.expLedger.update({ where: { id: entry.id }, data: { status: 'rejected', reviewedAt: new Date(), reviewerName: auth.admin.userId } })
      } else if (body.decision === 'revoke' && entry.status === 'granted') {
        const balance = Math.max(0, account.balance - Math.max(0, entry.amount))
        await tx.expAccount.update({ where: { userId: entry.userId }, data: { balance, level: levelForExp(balance).level } })
        result = await tx.expLedger.update({ where: { id: entry.id }, data: { status: 'revoked', reviewedAt: new Date(), reviewerName: auth.admin.userId } })
      } else {
        throw new Error('CONFLICT')
      }
      await tx.auditLog.create({ data: { adminId: auth.admin.id, action: `exp.${body.decision}`, entity: 'ExpLedger', entityId: entry.id } })
      return result
    }, { isolationLevel: 'Serializable' })
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
