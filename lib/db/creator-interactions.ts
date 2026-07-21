import { getPrisma } from '@/lib/prisma'
import { CreatorStudioError, todayUtc } from '@/lib/db/creator-studio'

export const TEXT_TO_SPEECH_PRICE_COINS = 300

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

type ReviewRow = {
  id: string
  userId: string
  workId: string
  rating: number
  body: string
  recommended: boolean
  spoiler: boolean
  createdAt: Date
  updatedAt: Date
  user: { id: string; name: string }
  replies: Array<{ id: string; userId: string; body: string; createdAt: Date; updatedAt: Date; user: { id: string; name: string } }>
  reactions: Array<{ userId: string; kind: string }>
}

const reviewInclude = {
  user: { select: { id: true, name: true } },
  replies: {
    where: { status: 'published' },
    orderBy: { createdAt: 'asc' as const },
    select: { id: true, userId: true, body: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true } } },
  },
  reactions: { select: { userId: true, kind: true } },
} as const

function presentReview(review: ReviewRow, viewerId?: string) {
  return {
    id: review.id,
    userId: review.userId,
    workId: review.workId,
    rating: review.rating,
    body: review.body,
    recommended: review.recommended,
    spoiler: review.spoiler,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    user: review.user,
    replies: review.replies.map((reply) => ({
      id: reply.id,
      userId: reply.userId,
      body: reply.body,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      user: reply.user,
    })),
    likes: review.reactions.filter((reaction) => reaction.kind === 'like').length,
    dislikes: review.reactions.filter((reaction) => reaction.kind === 'dislike').length,
    viewerReaction: viewerId ? review.reactions.find((reaction) => reaction.userId === viewerId)?.kind ?? null : null,
  }
}

export async function upsertReview(userId: string, workId: string, rating: number, body: string, recommended = true, spoiler = false) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !body.trim() || body.trim().length > 3000) throw new CreatorStudioError('VALIDATION')
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const work = await tx.creatorWork.findUnique({ where: { id: workId }, select: { status: true } })
    if (!work || work.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
    const previous = await tx.workReview.findUnique({ where: { userId_workId: { userId, workId } } })
    if (previous && previous.status !== 'published') {
      await tx.workReviewReply.deleteMany({ where: { reviewId: previous.id } })
      await tx.workReviewReaction.deleteMany({ where: { reviewId: previous.id } })
    }
    const review = await tx.workReview.upsert({
      where: { userId_workId: { userId, workId } },
      create: { userId, workId, rating, body: body.trim(), recommended, spoiler, status: 'published' },
      update: { rating, body: body.trim(), recommended, spoiler, status: 'published' },
      include: reviewInclude,
    })
    if (!previous || previous.status !== 'published') {
      await tx.creatorWork.update({ where: { id: workId }, data: { reviewCount: { increment: 1 } } })
      await incrementMetric(workId, { reviews: 1 }, tx)
    }
    return presentReview(review, userId)
  })
}

export async function updateReview(userId: string, input: { id: string; rating: number; body: string; recommended: boolean; spoiler: boolean }) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5 || !input.body.trim() || input.body.trim().length > 3000) throw new CreatorStudioError('VALIDATION')
  const prisma = getPrisma()
  const current = await prisma.workReview.findUnique({ where: { id: input.id }, select: { userId: true, status: true } })
  if (!current || current.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
  if (current.userId !== userId) throw new CreatorStudioError('FORBIDDEN')
  const review = await prisma.workReview.update({
    where: { id: input.id },
    data: { rating: input.rating, body: input.body.trim(), recommended: input.recommended, spoiler: input.spoiler },
    include: reviewInclude,
  })
  return presentReview(review, userId)
}

export async function createReviewReply(userId: string, reviewId: string, body: string) {
  if (!body.trim() || body.trim().length > 3000) throw new CreatorStudioError('VALIDATION')
  const prisma = getPrisma()
  const review = await prisma.workReview.findUnique({ where: { id: reviewId }, select: { status: true, work: { select: { status: true } } } })
  if (!review || review.status !== 'published' || review.work.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
  return prisma.workReviewReply.create({
    data: { reviewId, userId, body: body.trim(), status: 'published' },
    select: { id: true, userId: true, body: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true } } },
  })
}

export async function updateReviewReply(userId: string, id: string, body: string) {
  if (!body.trim() || body.trim().length > 3000) throw new CreatorStudioError('VALIDATION')
  const prisma = getPrisma()
  const current = await prisma.workReviewReply.findUnique({ where: { id }, select: { userId: true, status: true } })
  if (!current || current.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
  if (current.userId !== userId) throw new CreatorStudioError('FORBIDDEN')
  return prisma.workReviewReply.update({ where: { id }, data: { body: body.trim() }, select: { id: true, userId: true, body: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true } } } })
}

export async function deleteReviewReply(userId: string, id: string) {
  const prisma = getPrisma()
  const current = await prisma.workReviewReply.findUnique({ where: { id }, select: { userId: true, status: true } })
  if (!current || current.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
  if (current.userId !== userId) throw new CreatorStudioError('FORBIDDEN')
  await prisma.workReviewReply.update({ where: { id }, data: { status: 'deleted' } })
  return { id }
}

export async function toggleReviewReaction(userId: string, reviewId: string, kind: 'like' | 'dislike') {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const review = await tx.workReview.findUnique({ where: { id: reviewId }, select: { status: true, work: { select: { status: true } } } })
    if (!review || review.status !== 'published' || review.work.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
    const existing = await tx.workReviewReaction.findUnique({ where: { reviewId_userId: { reviewId, userId } } })
    let viewerReaction: 'like' | 'dislike' | null = kind
    if (existing?.kind === kind) {
      await tx.workReviewReaction.delete({ where: { id: existing.id } })
      viewerReaction = null
    } else if (existing) {
      await tx.workReviewReaction.update({ where: { id: existing.id }, data: { kind } })
    } else {
      await tx.workReviewReaction.create({ data: { reviewId, userId, kind } })
    }
    const [likes, dislikes] = await Promise.all([
      tx.workReviewReaction.count({ where: { reviewId, kind: 'like' } }),
      tx.workReviewReaction.count({ where: { reviewId, kind: 'dislike' } }),
    ])
    return { reviewId, likes, dislikes, viewerReaction }
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
    const current = await prisma.workReview.findUnique({ where: { id }, select: { userId: true, status: true } })
    if (!current || current.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
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
      const current = await tx.workReview.findUnique({ where: { id }, select: { userId: true, workId: true, status: true } })
      if (!current || current.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
      if (current.userId !== userId) throw new CreatorStudioError('FORBIDDEN')
      await tx.workReview.update({ where: { id }, data: { status: 'deleted' } })
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

export async function getTextToSpeechAccess(userId: string | undefined, workId: string) {
  const prisma = getPrisma()
  const work = await prisma.creatorWork.findUnique({
    where: { id: workId },
    select: { id: true, creatorId: true, type: true, status: true },
  })
  if (!work || work.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
  const eligible = work.type === 'novel'
  if (!eligible || !userId) return { eligible, entitled: false, priceCoins: TEXT_TO_SPEECH_PRICE_COINS }
  const owner = work.creatorId === userId
  const purchase = owner ? null : await prisma.workFeaturePurchase.findUnique({
    where: { userId_workId_feature: { userId, workId, feature: 'text_to_speech' } },
    select: { id: true },
  })
  return { eligible: true, entitled: owner || Boolean(purchase), priceCoins: TEXT_TO_SPEECH_PRICE_COINS }
}

async function purchaseTextToSpeechOnce(userId: string, workId: string) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const work = await tx.creatorWork.findUnique({
      where: { id: workId },
      select: { id: true, creatorId: true, type: true, status: true },
    })
    if (!work || work.status !== 'published' || work.type !== 'novel') throw new CreatorStudioError('NOT_FOUND')

    const account = await tx.coinAccount.upsert({ where: { userId }, create: { userId, balance: 0 }, update: {} })
    if (work.creatorId === userId) {
      return { entitlement: null, coinBalance: account.balance, idempotent: true, owner: true }
    }

    const existing = await tx.workFeaturePurchase.findUnique({
      where: { userId_workId_feature: { userId, workId, feature: 'text_to_speech' } },
    })
    if (existing) return { entitlement: existing, coinBalance: account.balance, idempotent: true, owner: false }

    const claimed = await tx.coinAccount.updateMany({
      where: { userId, balance: { gte: TEXT_TO_SPEECH_PRICE_COINS } },
      data: { balance: { decrement: TEXT_TO_SPEECH_PRICE_COINS } },
    })
    if (!claimed.count) throw new CreatorStudioError('INSUFFICIENT_BALANCE', { requiredCoins: TEXT_TO_SPEECH_PRICE_COINS })
    const updatedAccount = await tx.coinAccount.findUniqueOrThrow({ where: { userId } })
    const entitlement = await tx.workFeaturePurchase.create({
      data: { userId, workId, feature: 'text_to_speech', coinsSpent: TEXT_TO_SPEECH_PRICE_COINS },
    })
    await tx.coinLedger.create({
      data: {
        userId,
        kind: 'purchase',
        amount: -TEXT_TO_SPEECH_PRICE_COINS,
        balanceAfter: updatedAccount.balance,
        referenceId: entitlement.id,
        idempotencyKey: `work-feature:${userId}:${workId}:text_to_speech`,
        metadata: { feature: 'text_to_speech', workId, priceCoins: TEXT_TO_SPEECH_PRICE_COINS },
      },
    })
    return { entitlement, coinBalance: updatedAccount.balance, idempotent: false, owner: false }
  }, { isolationLevel: 'Serializable' })
}

export async function purchaseTextToSpeech(userId: string, workId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await purchaseTextToSpeechOnce(userId, workId)
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? error.code : null
      if (code !== 'P2034' && code !== 'P2002') throw error
      const existing = await getPrisma().workFeaturePurchase.findUnique({
        where: { userId_workId_feature: { userId, workId, feature: 'text_to_speech' } },
      })
      if (existing) {
        const account = await getPrisma().coinAccount.findUnique({ where: { userId } })
        return { entitlement: existing, coinBalance: account?.balance ?? 0, idempotent: true, owner: false }
      }
    }
  }
  throw new CreatorStudioError('INVALID_STATE')
}

const DAILY_TICKET_ALLOWANCE = 15

function bangkokDay(now = new Date()) {
  const shifted = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const key = shifted.toISOString().slice(0, 10)
  const start = new Date(`${key}T00:00:00+07:00`)
  return { key, start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
}

type TicketClient = Pick<ReturnType<typeof getPrisma>, 'ticketLedger'>

async function ensureDailyTicketGrant(userId: string, client: TicketClient, now = new Date()) {
  const day = bangkokDay(now)
  const existingCredits = await client.ticketLedger.aggregate({
    where: { userId, type: 'free', amount: { gt: 0 }, status: 'completed', createdAt: { gte: day.start, lt: day.end } },
    _sum: { amount: true },
  })
  const grantAmount = Math.max(0, DAILY_TICKET_ALLOWANCE - (existingCredits._sum.amount ?? 0))
  await client.ticketLedger.upsert({
    where: { idempotencyKey: `daily-ticket-grant:${userId}:${day.key}` },
    create: {
      userId,
      amount: grantAmount,
      type: 'free',
      reason: `สิทธิ์ตั๋วรายวัน ${day.key}`,
      idempotencyKey: `daily-ticket-grant:${userId}:${day.key}`,
      metadata: { allowance: DAILY_TICKET_ALLOWANCE, granted: grantAmount, timeZone: 'Asia/Bangkok' },
    },
    update: {},
  })
  return day
}

async function ticketState(userId: string, client: TicketClient, now = new Date()) {
  const day = bangkokDay(now)
  const [daily, dailySpent, monthly] = await Promise.all([
    client.ticketLedger.aggregate({
      where: { userId, type: { in: ['free', 'vote_free'] }, status: 'completed', createdAt: { gte: day.start, lt: day.end } },
      _sum: { amount: true },
    }),
    client.ticketLedger.aggregate({
      where: { userId, type: 'vote_free', status: 'completed', createdAt: { gte: day.start, lt: day.end } },
      _sum: { amount: true },
    }),
    client.ticketLedger.aggregate({
      where: { userId, type: { in: ['month', 'vote_month'] }, status: 'completed' },
      _sum: { amount: true },
    }),
  ])
  return {
    daily: {
      allowance: DAILY_TICKET_ALLOWANCE,
      used: Math.abs(Math.min(0, dailySpent._sum.amount ?? 0)),
      balance: Math.max(0, daily._sum.amount ?? 0),
      resetsAt: day.end.toISOString(),
    },
    monthly: { balance: Math.max(0, monthly._sum.amount ?? 0) },
  }
}

export async function getInteractionState(userId: string, workId: string) {
  const prisma = getPrisma()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const work = await tx.creatorWork.findUnique({ where: { id: workId }, select: { status: true, dailyVotes: true, monthlyVotes: true } })
        if (!work || work.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
        await ensureDailyTicketGrant(userId, tx)
        const [tickets, ownReview, reactionRows] = await Promise.all([
          ticketState(userId, tx),
          tx.workReview.findUnique({ where: { userId_workId: { userId, workId } }, include: reviewInclude }),
          tx.workReviewReaction.findMany({
            where: { userId, review: { workId, status: 'published' } },
            select: { reviewId: true, kind: true },
          }),
        ])
        return {
          tickets,
          totals: { daily: work.dailyVotes, monthly: work.monthlyVotes },
          review: ownReview?.status === 'published' ? presentReview(ownReview, userId) : null,
          reviewReactions: Object.fromEntries(reactionRows.map((reaction) => [reaction.reviewId, reaction.kind])),
        }
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2034' && attempt < 2) continue
      throw error
    }
  }
  throw new CreatorStudioError('INVALID_STATE')
}

export async function voteForWork(userId: string, workId: string, kind: 'daily' | 'monthly', amount: number, requestId: string) {
  if (!Number.isInteger(amount) || amount < 1 || amount > 10_000 || !/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) throw new CreatorStudioError('VALIDATION')
  const prisma = getPrisma()
  const idempotencyKey = `work-vote:${userId}:${requestId}`
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const work = await tx.creatorWork.findUnique({ where: { id: workId }, select: { status: true, dailyVotes: true, monthlyVotes: true } })
        if (!work || work.status !== 'published') throw new CreatorStudioError('NOT_FOUND')
        await ensureDailyTicketGrant(userId, tx)
        const existing = await tx.ticketLedger.findUnique({ where: { idempotencyKey } })
        if (existing) {
          if (existing.referenceId !== workId || existing.type !== (kind === 'daily' ? 'vote_free' : 'vote_month') || Math.abs(existing.amount) !== amount) throw new CreatorStudioError('VALIDATION')
          return {
            vote: { kind, amount, idempotent: true },
            tickets: await ticketState(userId, tx),
            totals: { daily: work.dailyVotes, monthly: work.monthlyVotes },
          }
        }
        const tickets = await ticketState(userId, tx)
        const available = kind === 'daily' ? tickets.daily.balance : tickets.monthly.balance
        if (available < amount) throw new CreatorStudioError('INSUFFICIENT_BALANCE', { tickets })
        await tx.ticketLedger.create({
          data: {
            userId,
            amount: -amount,
            type: kind === 'daily' ? 'vote_free' : 'vote_month',
            reason: `โหวตผลงาน ${amount} ใบ`,
            referenceId: workId,
            idempotencyKey,
            metadata: { kind, amount, requestId },
          },
        })
        const updated = await tx.creatorWork.update({
          where: { id: workId },
          data: kind === 'daily' ? { dailyVotes: { increment: amount } } : { monthlyVotes: { increment: amount } },
          select: { dailyVotes: true, monthlyVotes: true },
        })
        await incrementMetric(workId, kind === 'daily' ? { dailyVotes: amount } : { monthlyVotes: amount }, tx)
        return {
          vote: { kind, amount, idempotent: false },
          tickets: await ticketState(userId, tx),
          totals: { daily: updated.dailyVotes, monthly: updated.monthlyVotes },
        }
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2034' && attempt < 2) continue
      throw error
    }
  }
  throw new CreatorStudioError('INVALID_STATE')
}
