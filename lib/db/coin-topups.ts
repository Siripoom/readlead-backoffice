import 'server-only'

import { getPrisma } from '@/lib/prisma'
import { topUpReference } from '@/lib/member-topups'

export type CoinTopUpFilter = 'all' | 'pending' | 'approved' | 'rejected'
export type CoinTopUpDecision = 'approved' | 'rejected'

export class CoinTopUpReviewError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'CONFLICT' | 'INACTIVE_USER') {
    super(code)
    this.name = 'CoinTopUpReviewError'
  }
}

const adminSelect = {
  id: true,
  packageId: true,
  baseCoins: true,
  bonusCoins: true,
  totalCoins: true,
  amountSatang: true,
  status: true,
  slipUrl: true,
  slipContentType: true,
  slipSizeBytes: true,
  slipOriginalName: true,
  rejectionReason: true,
  reviewedAt: true,
  submittedAt: true,
  user: { select: { id: true, name: true, email: true, status: true } },
  reviewer: { select: { id: true, user: { select: { name: true } } } },
} as const

export function adminTopUpDto(item: {
  id: string
  packageId: string
  baseCoins: number
  bonusCoins: number
  totalCoins: number
  amountSatang: number
  status: 'pending' | 'approved' | 'rejected'
  slipContentType: string
  slipSizeBytes: number
  slipOriginalName: string
  rejectionReason: string | null
  reviewedAt: Date | null
  submittedAt: Date
  user: { id: string; name: string; email: string; status: string }
  reviewer: { id: string; user: { name: string } } | null
}) {
  return {
    id: item.id,
    reference: topUpReference(item.id),
    packageId: item.packageId,
    baseCoins: item.baseCoins,
    bonusCoins: item.bonusCoins,
    totalCoins: item.totalCoins,
    amountBaht: item.amountSatang / 100,
    status: item.status,
    slip: {
      url: `/api/finance/topups/${encodeURIComponent(item.id)}/slip`,
      contentType: item.slipContentType,
      sizeBytes: item.slipSizeBytes,
      name: item.slipOriginalName,
    },
    rejectionReason: item.rejectionReason,
    reviewedAt: item.reviewedAt?.toISOString() ?? null,
    submittedAt: item.submittedAt.toISOString(),
    user: item.user,
    reviewerName: item.reviewer?.user.name ?? null,
  }
}

export async function listCoinTopUps(input: {
  status: CoinTopUpFilter
  query: string
  page: number
  pageSize: number
}) {
  const prisma = getPrisma()
  const query = input.query.trim()
  const idQuery = query.replace(/^#?TU-/i, '').trim()
  const where = {
    ...(input.status === 'all' ? {} : { status: input.status }),
    ...(query ? {
      OR: [
        { id: { contains: idQuery, mode: 'insensitive' as const } },
        { user: { name: { contains: query, mode: 'insensitive' as const } } },
        { user: { email: { contains: query, mode: 'insensitive' as const } } },
      ],
    } : {}),
  }
  const [all, pending, approved, rejected, total, items] = await prisma.$transaction([
    prisma.coinTopUpRequest.count(),
    prisma.coinTopUpRequest.count({ where: { status: 'pending' } }),
    prisma.coinTopUpRequest.count({ where: { status: 'approved' } }),
    prisma.coinTopUpRequest.count({ where: { status: 'rejected' } }),
    prisma.coinTopUpRequest.count({ where }),
    prisma.coinTopUpRequest.findMany({
      where,
      select: adminSelect,
      orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
  ])
  return {
    items: items.map(adminTopUpDto),
    total,
    page: input.page,
    pageSize: input.pageSize,
    counts: { all, pending, approved, rejected },
  }
}

export async function getCoinTopUpSlip(id: string, adminId: string) {
  const prisma = getPrisma()
  const item = await prisma.coinTopUpRequest.findUnique({
    where: { id },
    select: { slipUrl: true },
  })
  if (!item) return null
  await prisma.auditLog.create({
    data: { adminId, action: 'finance.topup_proof_viewed', entity: 'CoinTopUpRequest', entityId: id },
  })
  return item.slipUrl
}

export async function decideCoinTopUp(input: {
  id: string
  decision: CoinTopUpDecision
  reason?: string
  adminId: string
}) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const current = await tx.coinTopUpRequest.findUnique({
      where: { id: input.id },
      select: { ...adminSelect, userId: true },
    })
    if (!current) throw new CoinTopUpReviewError('NOT_FOUND')
    if (current.status === input.decision) return { request: adminTopUpDto(current), idempotent: true }
    if (current.status !== 'pending') throw new CoinTopUpReviewError('CONFLICT')
    if (input.decision === 'approved' && current.user.status !== 'active') {
      throw new CoinTopUpReviewError('INACTIVE_USER')
    }

    const now = new Date()
    const claimed = await tx.coinTopUpRequest.updateMany({
      where: { id: input.id, status: 'pending' },
      data: {
        status: input.decision,
        rejectionReason: input.decision === 'rejected' ? input.reason : null,
        reviewerId: input.adminId,
        reviewedAt: now,
      },
    })
    if (!claimed.count) {
      const latest = await tx.coinTopUpRequest.findUnique({ where: { id: input.id }, select: adminSelect })
      if (latest?.status === input.decision) return { request: adminTopUpDto(latest), idempotent: true }
      throw new CoinTopUpReviewError('CONFLICT')
    }

    if (input.decision === 'approved') {
      const account = await tx.coinAccount.upsert({
        where: { userId: current.userId },
        create: { userId: current.userId, balance: current.totalCoins },
        update: { balance: { increment: current.totalCoins } },
      })
      await tx.coinLedger.create({
        data: {
          userId: current.userId,
          kind: 'topup',
          amount: current.totalCoins,
          balanceAfter: account.balance,
          referenceId: current.id,
          idempotencyKey: `topup-approval:${current.id}`,
          metadata: {
            packageId: current.packageId,
            baseCoins: current.baseCoins,
            bonusCoins: current.bonusCoins,
            paidAmountBaht: current.amountSatang / 100,
            paymentMethod: 'proof-upload',
          },
        },
      })
    }

    await tx.auditLog.create({
      data: {
        adminId: input.adminId,
        action: `finance.topup_${input.decision}`,
        entity: 'CoinTopUpRequest',
        entityId: current.id,
        detail: {
          userId: current.userId,
          packageId: current.packageId,
          amountSatang: current.amountSatang,
          totalCoins: current.totalCoins,
          ...(input.reason ? { reason: input.reason } : {}),
        },
      },
    })

    const updated = await tx.coinTopUpRequest.findUniqueOrThrow({ where: { id: current.id }, select: adminSelect })
    return { request: adminTopUpDto(updated), idempotent: false }
  })
}
