import { getPrisma } from '@/lib/prisma'
import { CreatorStudioError, todayUtc } from '@/lib/db/creator-studio'

type MetricClient = Pick<ReturnType<typeof getPrisma>, 'workMetricDaily'>

async function incrementMetric(workId: string, data: Partial<Record<'views' | 'coins' | 'revenueSatang' | 'shelfAdds' | 'dailyVotes' | 'monthlyVotes' | 'reviews' | 'comments', number>>, tx: MetricClient = getPrisma()) {
  const increments = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, { increment: value }]))
  return tx.workMetricDaily.upsert({
    where: { workId_date: { workId, date: todayUtc() } },
    create: { workId, date: todayUtc(), ...data },
    update: increments,
  })
}

export async function recordWorkView(input: { workId: string; userId?: string; viewerKey: string }) {
  const prisma = getPrisma()
  const work = await prisma.creatorWork.findUnique({ where: { id: input.workId }, select: { status: true } })
  if (!work || work.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
  try {
    await prisma.$transaction(async (tx) => {
      await tx.workView.create({ data: { workId: input.workId, userId: input.userId, viewerKey: input.viewerKey, viewedOn: todayUtc() } })
      await tx.creatorWork.update({ where: { id: input.workId }, data: { views: { increment: 1 } } })
      await incrementMetric(input.workId, { views: 1 }, tx)
    })
    return { recorded: true }
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') return { recorded: false }
    throw error
  }
}

export async function toggleShelf(userId: string, workId: string) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const work = await tx.creatorWork.findUnique({ where: { id: workId }, select: { status: true } })
    if (!work || work.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
    const existing = await tx.workShelf.findUnique({ where: { userId_workId: { userId, workId } } })
    if (existing) {
      await tx.workShelf.delete({ where: { id: existing.id } })
      await tx.creatorWork.update({ where: { id: workId }, data: { shelfCount: { decrement: 1 } } })
      return { active: false }
    }
    await tx.workShelf.create({ data: { userId, workId } })
    await tx.creatorWork.update({ where: { id: workId }, data: { shelfCount: { increment: 1 } } })
    await incrementMetric(workId, { shelfAdds: 1 }, tx)
    return { active: true }
  })
}

export async function toggleCreatorFollow(userId: string, creatorId: string) {
  if (userId === creatorId) throw new CreatorStudioError('VALIDATION')
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const creator = await tx.user.findUnique({ where: { id: creatorId }, select: { userType: true } })
    if (!creator || creator.userType !== 'creator') throw new CreatorStudioError('NOT_FOUND')
    const existing = await tx.creatorFollow.findUnique({ where: { followerId_creatorId: { followerId: userId, creatorId } } })
    if (existing) {
      await tx.creatorFollow.delete({ where: { id: existing.id } })
      await tx.creatorProfile.updateMany({ where: { userId: creatorId, followers: { gt: 0 } }, data: { followers: { decrement: 1 } } })
      return { active: false }
    }
    await tx.creatorFollow.create({ data: { followerId: userId, creatorId } })
    await tx.creatorProfile.upsert({ where: { userId: creatorId }, create: { userId: creatorId, followers: 1 }, update: { followers: { increment: 1 } } })
    return { active: true }
  })
}

export async function upsertReview(userId: string, workId: string, rating: number, body: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !body.trim() || body.trim().length > 3000) throw new CreatorStudioError('VALIDATION')
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const work = await tx.creatorWork.findUnique({ where: { id: workId }, select: { status: true } })
    if (!work || work.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
    const previous = await tx.workReview.findUnique({ where: { userId_workId: { userId, workId } } })
    const review = await tx.workReview.upsert({ where: { userId_workId: { userId, workId } }, create: { userId, workId, rating, body: body.trim(), status: 'published' }, update: { rating, body: body.trim(), status: 'published' } })
    if (!previous) {
      await tx.creatorWork.update({ where: { id: workId }, data: { reviewCount: { increment: 1 } } })
      await incrementMetric(workId, { reviews: 1 }, tx)
    }
    return review
  })
}

export async function createComment(userId: string, workId: string, body: string, parentId?: string) {
  if (!body.trim() || body.trim().length > 3000) throw new CreatorStudioError('VALIDATION')
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const work = await tx.creatorWork.findUnique({ where: { id: workId }, select: { status: true } })
    if (!work || work.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
    if (parentId) {
      const parent = await tx.workComment.findUnique({ where: { id: parentId }, select: { workId: true } })
      if (!parent || parent.workId !== workId) throw new CreatorStudioError('VALIDATION')
    }
    const comment = await tx.workComment.create({ data: { userId, workId, body: body.trim(), parentId, status: 'published' } })
    await tx.creatorWork.update({ where: { id: workId }, data: { commentCount: { increment: 1 } } })
    await incrementMetric(workId, { comments: 1 }, tx)
    return comment
  })
}

export async function updateMemberActivity(userId: string, kind: 'review' | 'comment', id: string, body: string) {
  if (!body.trim() || body.trim().length > 3000) throw new CreatorStudioError('VALIDATION')
  const prisma = getPrisma()
  if (kind === 'review') {
    const current = await prisma.workReview.findUnique({ where: { id }, select: { userId: true } })
    if (!current) throw new CreatorStudioError('NOT_FOUND')
    if (current.userId !== userId) throw new CreatorStudioError('FORBIDDEN')
    return prisma.workReview.update({ where: { id }, data: { body: body.trim(), status: 'published' }, select: { id: true, body: true, updatedAt: true } })
  }
  const current = await prisma.workComment.findUnique({ where: { id }, select: { userId: true } })
  if (!current) throw new CreatorStudioError('NOT_FOUND')
  if (current.userId !== userId) throw new CreatorStudioError('FORBIDDEN')
  return prisma.workComment.update({ where: { id }, data: { body: body.trim(), status: 'published' }, select: { id: true, body: true, updatedAt: true } })
}

export async function deleteMemberActivity(userId: string, kind: 'review' | 'comment', id: string) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    if (kind === 'review') {
      const current = await tx.workReview.findUnique({ where: { id }, select: { userId: true, workId: true } })
      if (!current) throw new CreatorStudioError('NOT_FOUND')
      if (current.userId !== userId) throw new CreatorStudioError('FORBIDDEN')
      await tx.workReview.delete({ where: { id } })
      await tx.creatorWork.updateMany({ where: { id: current.workId, reviewCount: { gt: 0 } }, data: { reviewCount: { decrement: 1 } } })
      return { id }
    }
    const current = await tx.workComment.findUnique({ where: { id }, select: { userId: true, workId: true, _count: { select: { replies: true } } } })
    if (!current) throw new CreatorStudioError('NOT_FOUND')
    if (current.userId !== userId) throw new CreatorStudioError('FORBIDDEN')
    await tx.workComment.delete({ where: { id } })
    const removed = current._count.replies + 1
    const work = await tx.creatorWork.findUnique({ where: { id: current.workId }, select: { commentCount: true } })
    if (work) await tx.creatorWork.update({ where: { id: current.workId }, data: { commentCount: Math.max(0, work.commentCount - removed) } })
    return { id }
  })
}

export async function purchaseEpisode(userId: string, episodeId: string) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const existing = await tx.episodePurchase.findUnique({ where: { userId_episodeId: { userId, episodeId } } })
    if (existing) {
      const account = await tx.coinAccount.findUnique({ where: { userId } })
      return { purchase: existing, coinBalance: account?.balance ?? 0, idempotent: true }
    }
    const episode = await tx.creatorEpisode.findUnique({ where: { id: episodeId }, include: { work: { select: { id: true, creatorId: true, status: true } } } })
    if (!episode || episode.status !== 'published' || episode.work.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
    const price = Math.max(0, episode.priceCoins)
    await tx.coinAccount.upsert({ where: { userId }, create: { userId, balance: 0 }, update: {} })
    const claimed = await tx.coinAccount.updateMany({ where: { userId, balance: { gte: price } }, data: { balance: { decrement: price } } })
    if (!claimed.count) throw new CreatorStudioError('INSUFFICIENT_BALANCE')
    const account = await tx.coinAccount.findUniqueOrThrow({ where: { userId } })
    const revenueSatang = price * 7
    const purchase = await tx.episodePurchase.create({ data: { userId, workId: episode.work.id, episodeId, coinsSpent: price, revenueSatang } })
    await tx.coinLedger.create({ data: { userId, kind: 'purchase', amount: -price, balanceAfter: account.balance, referenceId: purchase.id, idempotencyKey: `purchase:${userId}:${episodeId}` } })
    if (price > 0) {
      await tx.creatorRevenueLedger.create({ data: { userId: episode.work.creatorId, kind: 'earning', amountSatang: revenueSatang, referenceId: purchase.id, idempotencyKey: `purchase-revenue:${purchase.id}` } })
      await tx.creatorWork.update({ where: { id: episode.work.id }, data: { coins: { increment: price } } })
      await incrementMetric(episode.work.id, { coins: price, revenueSatang }, tx)
    }
    return { purchase, coinBalance: account.balance, idempotent: false }
  }, { isolationLevel: 'Serializable' })
}

export async function simulateTopup(userId: string, amount: number, idempotencyKey: string) {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SIMULATED_TOPUP !== 'true') throw new CreatorStudioError('FORBIDDEN')
  if (!Number.isInteger(amount) || amount < 1 || amount > 100_000 || !idempotencyKey) throw new CreatorStudioError('VALIDATION')
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const existing = await tx.coinLedger.findUnique({ where: { idempotencyKey } })
    if (existing) return { balance: existing.balanceAfter, idempotent: true }
    const account = await tx.coinAccount.upsert({ where: { userId }, create: { userId, balance: amount }, update: { balance: { increment: amount } } })
    await tx.coinLedger.create({ data: { userId, kind: 'topup', amount, balanceAfter: account.balance, idempotencyKey } })
    return { balance: account.balance, idempotent: false }
  })
}

export async function voteForWork(userId: string, workId: string, kind: 'daily' | 'monthly') {
  const prisma = getPrisma()
  const period = kind === 'daily' ? todayUtc().toISOString().slice(0, 10) : todayUtc().toISOString().slice(0, 7)
  const idempotencyKey = `work-vote:${kind}:${userId}:${workId}:${period}`
  return prisma.$transaction(async (tx) => {
    const work = await tx.creatorWork.findUnique({ where: { id: workId }, select: { status: true } })
    if (!work || work.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
    const existing = await tx.ticketLedger.findUnique({ where: { idempotencyKey } })
    if (existing) return { active: true, idempotent: true }
    const types = kind === 'daily' ? ['free', 'vote_free'] : ['month', 'vote_month']
    const balance = await tx.ticketLedger.aggregate({ where: { userId, type: { in: types }, status: 'completed' }, _sum: { amount: true } })
    if ((balance._sum.amount ?? 0) < 1) throw new CreatorStudioError('INSUFFICIENT_BALANCE')
    await tx.ticketLedger.create({ data: { userId, amount: -1, type: kind === 'daily' ? 'vote_free' : 'vote_month', reason: 'โหวตผลงาน', referenceId: workId, idempotencyKey } })
    await tx.creatorWork.update({ where: { id: workId }, data: kind === 'daily' ? { dailyVotes: { increment: 1 } } : { monthlyVotes: { increment: 1 } } })
    await incrementMetric(workId, kind === 'daily' ? { dailyVotes: 1 } : { monthlyVotes: 1 }, tx)
    return { active: true, idempotent: false }
  }, { isolationLevel: 'Serializable' })
}
