import 'server-only'

import { getPrisma } from '@/lib/prisma'
import type { PrismaClient } from '@/lib/generated/prisma/client'
import { topUpReference } from '@/lib/member-topups'

export type CoinTopUpFilter = 'all' | 'pending' | 'approved' | 'rejected'
export type CoinTopUpDecision = 'approved' | 'rejected'

export class CoinTopUpReviewError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'CONFLICT' | 'INACTIVE_USER') {
    super(code)
    this.name = 'CoinTopUpReviewError'
  }
}

type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

// Credits a top-up's coins to the user's balance and writes the ledger entry
// — the only place CoinAccount.balance may change. Shared by the admin
// approval path (decideCoinTopUp) and the Omise webhook handler, so a
// retried webhook can't double-credit: the unique CoinLedger.idempotencyKey
// constraint is what actually dedupes, not any caller-side check.
export async function creditTopUp(
  tx: TransactionClient,
  request: {
    id: string
    userId: string
    packageId: string
    baseCoins: number
    bonusCoins: number
    totalCoins: number
    amountSatang: number
    paymentMethod: string
  },
  idempotencyKey: string,
) {
  const account = await tx.coinAccount.upsert({
    where: { userId: request.userId },
    create: { userId: request.userId, balance: request.totalCoins },
    update: { balance: { increment: request.totalCoins } },
  })
  await tx.coinLedger.create({
    data: {
      userId: request.userId,
      kind: 'topup',
      amount: request.totalCoins,
      balanceAfter: account.balance,
      referenceId: request.id,
      idempotencyKey,
      metadata: {
        packageId: request.packageId,
        baseCoins: request.baseCoins,
        bonusCoins: request.bonusCoins,
        paidAmountBaht: request.amountSatang / 100,
        paymentMethod: request.paymentMethod,
      },
    },
  })
}

const adminSelect = {
  id: true,
  packageId: true,
  baseCoins: true,
  bonusCoins: true,
  totalCoins: true,
  amountSatang: true,
  paymentMethod: true,
  status: true,
  slipContentType: true,
  slipSizeBytes: true,
  slipOriginalName: true,
  rejectionReason: true,
  reviewedAt: true,
  submittedAt: true,
  user: { select: { id: true, name: true, email: true, status: true } },
  reviewer: { select: { id: true, user: { select: { name: true } } } },
} as const

// listCoinTopUps scopes to paymentMethod: 'proof-upload' (gateway-originated
// top-ups are auto-approved/rejected via the Omise webhook and never reach
// this admin review queue), so slip fields are always populated here even
// though the column is nullable at the schema level.
export function adminTopUpDto(item: {
  id: string
  packageId: string
  baseCoins: number
  bonusCoins: number
  totalCoins: number
  amountSatang: number
  paymentMethod: string
  status: 'pending' | 'approved' | 'rejected' | 'authorizing' | 'failed' | 'expired'
  slipContentType: string | null
  slipSizeBytes: number | null
  slipOriginalName: string | null
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
    paymentMethod: item.paymentMethod,
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
  // Gateway-originated top-ups are settled automatically by the Omise
  // webhook and never need human review, so this admin queue only ever
  // shows the manual proof-upload flow.
  const where = {
    paymentMethod: 'proof-upload',
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
    prisma.coinTopUpRequest.count({ where: { paymentMethod: 'proof-upload' } }),
    prisma.coinTopUpRequest.count({ where: { paymentMethod: 'proof-upload', status: 'pending' } }),
    prisma.coinTopUpRequest.count({ where: { paymentMethod: 'proof-upload', status: 'approved' } }),
    prisma.coinTopUpRequest.count({ where: { paymentMethod: 'proof-upload', status: 'rejected' } }),
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
      await creditTopUp(tx, current, `topup-approval:${current.id}`)
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
