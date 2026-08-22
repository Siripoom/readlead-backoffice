import { NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import { expProgress, voteFanTotals, weeklyCapMeters } from '@/lib/exp-rules'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi('exp')
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const prisma = getPrisma()
  const account = await prisma.expAccount.findUnique({
    where: { userId: id },
    include: { user: { select: { id: true, name: true, email: true, joinedAt: true } } },
  })
  if (!account) return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 })

  const [ledger, tickets] = await Promise.all([
    prisma.expLedger.findMany({ where: { userId: id }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.ticketLedger.findMany({
      where: { userId: id, referenceId: { not: null }, type: { in: ['vote_free', 'vote_month', 'tip', 'subscription', 'revoke'] } },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const workIds = [...new Set(tickets.map((entry) => entry.referenceId).filter((value): value is string => Boolean(value)))]
  const works = workIds.length
    ? await prisma.creatorWork.findMany({ where: { id: { in: workIds } }, select: { id: true, title: true } })
    : []
  const workNames = new Map(works.map((work) => [work.id, work.title]))
  const voteFanWorks = workIds.flatMap((workId) => {
    const workEntries = tickets.filter((entry) => entry.referenceId === workId)
    const totals = voteFanTotals(workEntries)
    if (!workNames.has(workId) || totals.fanPoints <= 0) return []
    return [{ workId, title: workNames.get(workId)!, ...totals }]
  }).sort((a, b) => b.fanPoints - a.fanPoints)

  return NextResponse.json({
    account: { ...account, progress: expProgress(account.balance) },
    weeklyCaps: weeklyCapMeters(ledger),
    voteFanWorks,
    ledger,
  })
}
