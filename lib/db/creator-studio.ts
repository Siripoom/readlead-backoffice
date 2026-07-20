import { getPrisma } from '@/lib/prisma'
import { decryptWriterApplicationPayload, encryptWriterApplicationPayload } from '@/lib/writer-application-crypto'
import type { CreatorEpisodeStatus, CreatorEpisodeType, CreatorModerationType, CreatorWorkOrigin, CreatorWorkStatus, CreatorWorkType } from '@/lib/generated/prisma/enums'

export class CreatorStudioError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_STATE' | 'INSUFFICIENT_BALANCE' | 'VALIDATION' | 'NOT_READY',
    public readonly details?: Record<string, unknown>,
  ) {
    super(code)
    this.name = 'CreatorStudioError'
  }
}

const workSummarySelect = {
  id: true,
  type: true,
  origin: true,
  status: true,
  title: true,
  category: true,
  rating: true,
  tagline: true,
  seriesStatus: true,
  rejectionReason: true,
  coverIsPublic: true,
  approvedAt: true,
  publishedAt: true,
  updatedAt: true,
  views: true,
  coins: true,
  shelfCount: true,
  dailyVotes: true,
  monthlyVotes: true,
  reviewCount: true,
  commentCount: true,
  moderationRequests: {
    where: { type: { in: ['publication', 'translation'] as CreatorModerationType[] } },
    orderBy: { submittedAt: 'desc' },
    take: 1,
    select: { id: true, status: true, reason: true, submittedAt: true, reviewedAt: true },
  },
  _count: { select: { episodes: true } },
} as const

export function creatorWorkCapabilities(status: CreatorWorkStatus) {
  return {
    canSubmitReview: status === 'draft' || status === 'rejected',
    canCreateDraftEpisode: !['deletion_pending', 'archived'].includes(status),
    canPublishEpisode: status === 'approved' || status === 'published',
  }
}

function presentCreatorWork<T extends { status: CreatorWorkStatus; moderationRequests?: Array<unknown> }>(work: T) {
  const { moderationRequests, ...data } = work
  return {
    ...data,
    moderation: moderationRequests?.[0] ?? null,
    capabilities: creatorWorkCapabilities(work.status),
  }
}

export function todayUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function periodStart(year: number, month: number) {
  return month === 0 ? new Date(Date.UTC(year, 0, 1)) : new Date(Date.UTC(year, month - 1, 1))
}

function periodEnd(year: number, month: number) {
  return month === 0 ? new Date(Date.UTC(year + 1, 0, 1)) : new Date(Date.UTC(year, month, 1))
}

function nextPayoutLabel(now = new Date()) {
  const year = now.getUTCFullYear()
  const month = now.getUTCDate() < 25 ? now.getUTCMonth() : now.getUTCMonth() + 1
  return new Date(Date.UTC(year, month, 25)).toISOString()
}

export async function getCreatorDashboard(userId: string, input: {
  type: CreatorWorkType | 'all'
  metric: 'coins' | 'views' | 'shelf' | 'dailyVotes' | 'monthlyVotes' | 'reviews' | 'comments' | 'revenue'
  year: number
  month: number
  query: string
  sort: 'published' | 'recent' | 'oldest' | 'dailyVotes' | 'monthlyVotes' | 'views'
  page: number
  pageSize: number
}) {
  const prisma = getPrisma()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, userType: true, creatorProfile: true, writerApplication: { select: { penName: true } } },
  })
  if (!user || user.userType !== 'creator') throw new CreatorStudioError('FORBIDDEN')

  const typeWhere = input.type === 'all' ? {} : { type: input.type }
  const worksWhere = { creatorId: userId, ...typeWhere }
  const listWhere = {
    creatorId: userId,
    ...typeWhere,
    ...(input.query ? { title: { contains: input.query, mode: 'insensitive' as const } } : {}),
  }
  const orderBy = input.sort === 'published' ? { publishedAt: 'desc' as const }
    : input.sort === 'recent' ? { updatedAt: 'desc' as const }
      : input.sort === 'oldest' ? { updatedAt: 'asc' as const }
        : input.sort === 'dailyVotes' ? { dailyVotes: 'desc' as const }
          : input.sort === 'monthlyVotes' ? { monthlyVotes: 'desc' as const }
            : { views: 'desc' as const }
  const start = periodStart(input.year, input.month)
  const end = periodEnd(input.year, input.month)
  const dayStart = todayUtc()
  const monthStart = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), 1))
  const yearStart = new Date(Date.UTC(dayStart.getUTCFullYear(), 0, 1))

  const [workCount, episodeCount, overview, chartRows, total, works, followerCount, revenueRows, available, pendingWithdrawals] = await prisma.$transaction([
    prisma.creatorWork.count({ where: { creatorId: userId } }),
    prisma.creatorEpisode.count({ where: { work: { creatorId: userId } } }),
    prisma.creatorWork.aggregate({ where: worksWhere, _sum: { coins: true, views: true, shelfCount: true, dailyVotes: true, monthlyVotes: true, reviewCount: true, commentCount: true } }),
    prisma.workMetricDaily.findMany({ where: { work: worksWhere, date: { gte: start, lt: end } }, orderBy: { date: 'asc' } }),
    prisma.creatorWork.count({ where: listWhere }),
    prisma.creatorWork.findMany({ where: listWhere, select: workSummarySelect, orderBy, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.creatorFollow.count({ where: { creatorId: userId } }),
    prisma.creatorRevenueLedger.groupBy({ by: ['kind'], where: { userId, createdAt: { gte: yearStart } }, orderBy: { kind: 'asc' }, _sum: { amountSatang: true } }),
    prisma.creatorRevenueLedger.aggregate({ where: { userId }, _sum: { amountSatang: true } }),
    prisma.withdrawalRequest.aggregate({ where: { userId, status: 'pending' }, _sum: { amountSatang: true } }),
  ])

  const incomeByRange = async (from: Date) => prisma.creatorRevenueLedger.aggregate({ where: { userId, kind: 'earning', createdAt: { gte: from } }, _sum: { amountSatang: true } })
  const [todayIncome, monthIncome, yearIncome] = await Promise.all([incomeByRange(dayStart), incomeByRange(monthStart), incomeByRange(yearStart)])
  const chart = new Map<string, number>()
  for (const row of chartRows) {
    const key = row.date.toISOString().slice(0, 10)
    const value = input.metric === 'revenue' ? row.revenueSatang
      : input.metric === 'shelf' ? row.shelfAdds
        : input.metric === 'reviews' ? row.reviews
          : input.metric === 'comments' ? row.comments
            : row[input.metric]
    chart.set(key, (chart.get(key) ?? 0) + value)
  }

  return {
    profile: {
      id: user.id,
      displayName: user.writerApplication?.penName || user.name,
      email: user.email,
      works: workCount,
      followers: followerCount,
      episodes: episodeCount,
    },
    income: {
      todaySatang: todayIncome._sum.amountSatang ?? 0,
      monthSatang: monthIncome._sum.amountSatang ?? 0,
      yearSatang: yearIncome._sum.amountSatang ?? 0,
    },
    balance: {
      availableSatang: Math.max(0, available._sum.amountSatang ?? 0),
      pendingSatang: pendingWithdrawals._sum.amountSatang ?? 0,
      nextPayoutAt: nextPayoutLabel(),
    },
    overview: {
      coins: overview._sum.coins ?? 0,
      views: overview._sum.views ?? 0,
      shelf: overview._sum.shelfCount ?? 0,
      dailyVotes: overview._sum.dailyVotes ?? 0,
      monthlyVotes: overview._sum.monthlyVotes ?? 0,
      reviews: overview._sum.reviewCount ?? 0,
      comments: overview._sum.commentCount ?? 0,
    },
    chart: [...chart].map(([date, value]) => ({ date, value })),
    worksPage: { items: works.map(presentCreatorWork), total, page: input.page, pageSize: input.pageSize },
    revenueBreakdown: revenueRows,
  }
}

export async function listCreatorWorks(userId: string) {
  const works = await getPrisma().creatorWork.findMany({ where: { creatorId: userId }, select: workSummarySelect, orderBy: { updatedAt: 'desc' } })
  return works.map(presentCreatorWork)
}

export async function getCreatorWork(userId: string, id: string) {
  const work = await getPrisma().creatorWork.findUnique({
    where: { id },
    include: {
      episodes: { orderBy: { episodeNumber: 'asc' }, include: { assets: { orderBy: { sortOrder: 'asc' }, select: { id: true, kind: true, contentType: true, sizeBytes: true, sortOrder: true, durationSeconds: true, isPublic: true, createdAt: true } } } },
      reviews: { where: { status: 'published' }, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } },
      comments: { where: { status: 'published', parentId: null }, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } }, replies: { include: { user: { select: { name: true } } } } } },
      moderationRequests: { where: { type: { in: ['publication', 'translation'] } }, orderBy: { submittedAt: 'desc' }, take: 1, select: { id: true, status: true, reason: true, submittedAt: true, reviewedAt: true } },
      _count: { select: { episodes: true } },
    },
  })
  if (!work) throw new CreatorStudioError('NOT_FOUND')
  if (work.creatorId !== userId) throw new CreatorStudioError('FORBIDDEN')
  return presentCreatorWork(work)
}

export interface CreatorWorkInput {
  type: CreatorWorkType
  origin: CreatorWorkOrigin
  title: string
  category: string
  rating: string
  creationMethod: string
  tagline: string
  synopsis: string
  tags: string[]
  originalAuthor?: string
  translatorName?: string
  originalLanguage?: string
  originalTitle?: string
  seriesStatus?: string
}

export async function createCreatorWork(userId: string, input: CreatorWorkInput) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const work = await tx.creatorWork.create({ data: { ...input, creatorId: userId, status: 'draft' } })
    await tx.creatorProfile.upsert({ where: { userId }, create: { userId, works: 1 }, update: { works: { increment: 1 } } })
    return { ...work, moderation: null, capabilities: creatorWorkCapabilities(work.status) }
  })
}

export async function submitCreatorWorkForReview(userId: string, id: string) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const current = await tx.creatorWork.findUnique({ where: { id }, select: { id: true, creatorId: true, status: true } })
    if (!current) throw new CreatorStudioError('NOT_FOUND')
    if (current.creatorId !== userId) throw new CreatorStudioError('FORBIDDEN')
    if (current.status === 'pending_review') {
      const existing = await tx.creatorModerationRequest.findFirst({ where: { workId: id, status: 'pending', type: { in: ['publication', 'translation'] } }, orderBy: { submittedAt: 'desc' } })
      if (!existing) throw new CreatorStudioError('INVALID_STATE')
      return existing
    }
    if (current.status !== 'draft' && current.status !== 'rejected') throw new CreatorStudioError('INVALID_STATE')
    const claimed = await tx.creatorWork.updateMany({ where: { id, creatorId: userId, status: { in: ['draft', 'rejected'] } }, data: { status: 'pending_review', rejectionReason: null, approvedAt: null, coverIsPublic: false } })
    if (!claimed.count) {
      const existing = await tx.creatorModerationRequest.findFirst({ where: { workId: id, status: 'pending', type: { in: ['publication', 'translation'] } }, orderBy: { submittedAt: 'desc' } })
      if (existing) return existing
      throw new CreatorStudioError('INVALID_STATE')
    }
    const request = await tx.creatorModerationRequest.create({ data: { workId: id, type: 'publication' } })
    await tx.auditLog.create({ data: { action: current.status === 'rejected' ? 'creator_work.resubmit_review' : 'creator_work.submit_review', entity: 'CreatorWork', entityId: id, detail: { previousStatus: current.status } } })
    return request
  })
}

export async function updateCreatorWork(userId: string, id: string, input: Partial<CreatorWorkInput>) {
  const current = await getPrisma().creatorWork.findUnique({ where: { id }, select: { creatorId: true, status: true } })
  if (!current) throw new CreatorStudioError('NOT_FOUND')
  if (current.creatorId !== userId) throw new CreatorStudioError('FORBIDDEN')
  if (current.status === 'archived' || current.status === 'deletion_pending' || current.status === 'pending_review') throw new CreatorStudioError('INVALID_STATE')
  const data = current.status === 'approved' || current.status === 'published'
    ? Object.fromEntries(Object.entries(input).filter(([key]) => ['tagline', 'synopsis', 'tags', 'seriesStatus'].includes(key)))
    : input
  return getPrisma().creatorWork.update({ where: { id }, data })
}

export async function requestCreatorWorkDeletion(userId: string, id: string, reason: string) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const current = await tx.creatorWork.findUnique({ where: { id }, select: { creatorId: true, status: true } })
    if (!current) throw new CreatorStudioError('NOT_FOUND')
    if (current.creatorId !== userId) throw new CreatorStudioError('FORBIDDEN')
    if (current.status === 'archived' || current.status === 'deletion_pending') throw new CreatorStudioError('INVALID_STATE')
    await tx.creatorWork.update({ where: { id }, data: { status: 'deletion_pending' } })
    return tx.creatorModerationRequest.create({ data: { workId: id, type: 'deletion', reason } })
  })
}

export interface CreatorEpisodeInput {
  title: string
  type: CreatorEpisodeType
  status: CreatorEpisodeStatus
  priceCoins: number
  content?: string
  scheduledAt?: Date | null
  durationSeconds?: number | null
}

export async function createCreatorEpisodes(userId: string, workId: string, inputs: CreatorEpisodeInput[]) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const work = await tx.creatorWork.findUnique({ where: { id: workId }, select: { creatorId: true, status: true, _count: { select: { episodes: true } } } })
    if (!work) throw new CreatorStudioError('NOT_FOUND')
    if (work.creatorId !== userId) throw new CreatorStudioError('FORBIDDEN')
    if (work.status === 'archived' || work.status === 'deletion_pending') throw new CreatorStudioError('INVALID_STATE')
    const canPublish = work.status === 'approved' || work.status === 'published'
    for (const input of inputs) {
      if (!canPublish && input.status !== 'draft') throw new CreatorStudioError('INVALID_STATE')
      if ((input.status === 'published' || input.status === 'scheduled') && input.type !== 'text') throw new CreatorStudioError('NOT_READY')
      if ((input.status === 'published' || input.status === 'scheduled') && !input.content?.trim()) throw new CreatorStudioError('VALIDATION')
    }
    const created = []
    const now = new Date()
    for (const [index, input] of inputs.entries()) {
      created.push(await tx.creatorEpisode.create({ data: {
        ...input,
        workId,
        episodeNumber: work._count.episodes + index + 1,
        publishedAt: input.status === 'published' ? now : null,
      } }))
    }
    if (work.status === 'approved' && inputs.some((input) => input.status === 'published')) {
      await tx.creatorWork.update({ where: { id: workId }, data: { status: 'published', publishedAt: now, coverIsPublic: true } })
    }
    return created
  }, { isolationLevel: 'Serializable' })
}

export async function updateCreatorEpisode(userId: string, id: string, input: Partial<CreatorEpisodeInput>) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const episode = await tx.creatorEpisode.findUnique({ where: { id }, include: { assets: { select: { id: true, kind: true } }, work: { select: { id: true, creatorId: true, status: true } } } })
    if (!episode) throw new CreatorStudioError('NOT_FOUND')
    if (episode.work.creatorId !== userId) throw new CreatorStudioError('FORBIDDEN')
    if (episode.work.status === 'archived' || episode.work.status === 'deletion_pending') throw new CreatorStudioError('INVALID_STATE')
    const requestedStatus = input.status ?? episode.status
    if (episode.work.status !== 'approved' && episode.work.status !== 'published' && requestedStatus !== 'draft') throw new CreatorStudioError('INVALID_STATE')
    const content = input.content ?? episode.content
    if ((requestedStatus === 'published' || requestedStatus === 'scheduled') && episode.type === 'text' && !content?.trim()) throw new CreatorStudioError('VALIDATION')
    if ((requestedStatus === 'published' || requestedStatus === 'scheduled') && episode.type === 'image' && !episode.assets.some((asset) => asset.kind === 'page')) throw new CreatorStudioError('NOT_READY')
    if ((requestedStatus === 'published' || requestedStatus === 'scheduled') && episode.type === 'audio' && !episode.assets.some((asset) => asset.kind === 'audio')) throw new CreatorStudioError('NOT_READY')
    const now = new Date()
    const updated = await tx.creatorEpisode.update({ where: { id }, data: { ...input, ...(requestedStatus === 'published' ? { publishedAt: episode.publishedAt ?? now } : {}) } })
    if (requestedStatus === 'published') {
      await tx.workAsset.updateMany({ where: { episodeId: id }, data: { isPublic: true } })
      if (episode.work.status === 'approved') await tx.creatorWork.updateMany({ where: { id: episode.work.id, status: 'approved' }, data: { status: 'published', publishedAt: now, coverIsPublic: true } })
    }
    return updated
  })
}

export async function publishDueCreatorEpisodes(now = new Date()) {
  const prisma = getPrisma()
  const due = await prisma.creatorEpisode.findMany({ where: { status: 'scheduled', scheduledAt: { lte: now }, work: { status: { in: ['approved', 'published'] } } }, select: { id: true }, orderBy: { scheduledAt: 'asc' }, take: 200 })
  let published = 0
  let skipped = 0
  for (const item of due) {
    try {
      await prisma.$transaction(async (tx) => {
        const episode = await tx.creatorEpisode.findUnique({ where: { id: item.id }, include: { assets: { select: { kind: true } }, work: { select: { id: true, status: true } } } })
        if (!episode || episode.status !== 'scheduled' || !episode.scheduledAt || episode.scheduledAt > now) return
        const ready = episode.type === 'text' ? Boolean(episode.content?.trim()) : episode.type === 'image' ? episode.assets.some((asset) => asset.kind === 'page') : episode.assets.some((asset) => asset.kind === 'audio')
        if (!ready || (episode.work.status !== 'approved' && episode.work.status !== 'published')) throw new CreatorStudioError('NOT_READY')
        const claimed = await tx.creatorEpisode.updateMany({ where: { id: episode.id, status: 'scheduled', scheduledAt: { lte: now } }, data: { status: 'published', publishedAt: now } })
        if (!claimed.count) return
        await tx.workAsset.updateMany({ where: { episodeId: episode.id }, data: { isPublic: true } })
        if (episode.work.status === 'approved') await tx.creatorWork.updateMany({ where: { id: episode.work.id, status: 'approved' }, data: { status: 'published', publishedAt: now, coverIsPublic: true } })
        published += 1
      })
    } catch (error) {
      if (error instanceof CreatorStudioError) skipped += 1
      else throw error
    }
  }
  return { checked: due.length, published, skipped }
}

export async function deleteCreatorEpisode(userId: string, id: string) {
  const episode = await getPrisma().creatorEpisode.findUnique({ where: { id }, select: { work: { select: { creatorId: true, status: true } } } })
  if (!episode) throw new CreatorStudioError('NOT_FOUND')
  if (episode.work.creatorId !== userId) throw new CreatorStudioError('FORBIDDEN')
  if (episode.work.status === 'archived' || episode.work.status === 'deletion_pending') throw new CreatorStudioError('INVALID_STATE')
  return getPrisma().creatorEpisode.delete({ where: { id }, select: { id: true } })
}

export async function createWithdrawal(userId: string, amountBaht: number) {
  const prisma = getPrisma()
  const amountSatang = Math.round(amountBaht * 100)
  if (!Number.isInteger(amountSatang) || amountSatang < 10_000 || amountSatang > 2_000_000) throw new CreatorStudioError('VALIDATION')
  return prisma.$transaction(async (tx) => {
    const [user, application, ledger] = await Promise.all([
      tx.user.findUnique({ where: { id: userId }, select: { name: true, userType: true } }),
      tx.writerApplication.findUnique({ where: { userId }, select: { status: true, encryptedPayload: true } }),
      tx.creatorRevenueLedger.aggregate({ where: { userId }, _sum: { amountSatang: true } }),
    ])
    if (!user || user.userType !== 'creator') throw new CreatorStudioError('FORBIDDEN')
    if (!application || application.status !== 'approved') throw new CreatorStudioError('NOT_READY')
    if ((ledger._sum.amountSatang ?? 0) < amountSatang) throw new CreatorStudioError('INSUFFICIENT_BALANCE')
    const details = decryptWriterApplicationPayload(application.encryptedPayload)
    if (!details.bankName || !details.accountNumber || !details.accountName) throw new CreatorStudioError('NOT_READY')
    const taxSatang = Math.floor(amountSatang * 0.03)
    const netSatang = amountSatang - taxSatang
    const encryptedDestination = encryptWriterApplicationPayload({ bankName: details.bankName, accountNumber: details.accountNumber, accountName: details.accountName })
    const withdrawal = await tx.withdrawalRequest.create({ data: {
      userId,
      creator: user.name,
      bank: 'encrypted',
      bankAccount: `••••${details.accountNumber.slice(-4)}`,
      amount: amountBaht,
      amountSatang,
      taxSatang,
      feeSatang: 0,
      netSatang,
      encryptedDestination,
    } })
    await tx.creatorRevenueLedger.create({ data: {
      userId,
      kind: 'withdrawal_reserve',
      amountSatang: -amountSatang,
      referenceId: withdrawal.id,
      idempotencyKey: `withdrawal-reserve:${withdrawal.id}`,
    } })
    await tx.withdrawalHistory.create({ data: { withdrawalId: withdrawal.id, status: 'pending', note: 'Creator submitted withdrawal request' } })
    return { id: withdrawal.id, amount: amountBaht, tax: taxSatang / 100, netAmount: netSatang / 100, status: withdrawal.status, requestedAt: withdrawal.requestedAt }
  }, { isolationLevel: 'Serializable' })
}

export async function listCreatorWithdrawals(userId: string) {
  return getPrisma().withdrawalRequest.findMany({
    where: { userId },
    select: { id: true, amount: true, amountSatang: true, taxSatang: true, feeSatang: true, netSatang: true, status: true, requestedAt: true, reviewedAt: true },
    orderBy: { requestedAt: 'desc' },
  })
}

export async function createAutomaticWithdrawalRequests(now = new Date()) {
  if (now.getUTCDate() !== 25) throw new CreatorStudioError('INVALID_STATE')
  const prisma = getPrisma()
  const period = now.toISOString().slice(0, 7)
  const balances = await prisma.creatorRevenueLedger.groupBy({ by: ['userId'], orderBy: { userId: 'asc' }, _sum: { amountSatang: true } })
  const results: Array<{ userId: string; id?: string; skipped?: string }> = []
  for (const row of balances) {
    const amountSatang = Math.min(2_000_000, row._sum.amountSatang ?? 0)
    if (amountSatang < 10_000) { results.push({ userId: row.userId, skipped: 'below_minimum' }); continue }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.withdrawalRequest.findUnique({ where: { userId_payoutPeriod: { userId: row.userId, payoutPeriod: period } }, select: { id: true } })
        if (existing) return existing
        const [user, application, latestBalance] = await Promise.all([
          tx.user.findUnique({ where: { id: row.userId }, select: { name: true, userType: true } }),
          tx.writerApplication.findUnique({ where: { userId: row.userId }, select: { status: true, encryptedPayload: true } }),
          tx.creatorRevenueLedger.aggregate({ where: { userId: row.userId }, _sum: { amountSatang: true } }),
        ])
        if (!user || user.userType !== 'creator' || !application || application.status !== 'approved') throw new CreatorStudioError('NOT_READY')
        const reservedSatang = Math.min(2_000_000, latestBalance._sum.amountSatang ?? 0)
        if (reservedSatang < 10_000) throw new CreatorStudioError('INSUFFICIENT_BALANCE')
        const details = decryptWriterApplicationPayload(application.encryptedPayload)
        if (!details.bankName || !details.accountNumber || !details.accountName) throw new CreatorStudioError('NOT_READY')
        const taxSatang = Math.floor(reservedSatang * 0.03)
        const withdrawal = await tx.withdrawalRequest.create({ data: { userId: row.userId, creator: user.name, bank: 'encrypted', bankAccount: `••••${details.accountNumber.slice(-4)}`, amount: reservedSatang / 100, amountSatang: reservedSatang, taxSatang, feeSatang: 0, netSatang: reservedSatang - taxSatang, encryptedDestination: encryptWriterApplicationPayload({ bankName: details.bankName, accountNumber: details.accountNumber, accountName: details.accountName }), payoutMode: 'automatic', payoutPeriod: period } })
        await tx.creatorRevenueLedger.create({ data: { userId: row.userId, kind: 'withdrawal_reserve', amountSatang: -reservedSatang, referenceId: withdrawal.id, idempotencyKey: `automatic-withdrawal-reserve:${row.userId}:${period}` } })
        await tx.withdrawalHistory.create({ data: { withdrawalId: withdrawal.id, status: 'pending', note: `Automatic payout cycle ${period}` } })
        return withdrawal
      }, { isolationLevel: 'Serializable' })
      results.push({ userId: row.userId, id: result.id })
    } catch (error) {
      if (error instanceof CreatorStudioError) results.push({ userId: row.userId, skipped: error.code })
      else throw error
    }
  }
  return { period, results }
}
