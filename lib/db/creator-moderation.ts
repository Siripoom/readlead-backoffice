import { getPrisma } from '@/lib/prisma'

export class CreatorModerationError extends Error {
  constructor(public code: 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION') { super(code); this.name = 'CreatorModerationError' }
}

export async function listCreatorModeration(input: { status?: 'pending' | 'approved' | 'rejected'; type?: 'publication' | 'translation' | 'deletion'; query?: string }) {
  const prisma = getPrisma()
  const where = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.type ? { type: input.type } : {}),
    ...(input.query ? { OR: [{ work: { title: { contains: input.query, mode: 'insensitive' as const } } }, { work: { creator: { name: { contains: input.query, mode: 'insensitive' as const } } } }] } : {}),
  }
  const [items, grouped] = await Promise.all([
    prisma.creatorModerationRequest.findMany({ where, select: { id: true, type: true, status: true, reason: true, submittedAt: true, reviewedAt: true, work: { select: { id: true, title: true, type: true, origin: true, status: true, category: true, creator: { select: { id: true, name: true, email: true } }, _count: { select: { episodes: true } } } } }, orderBy: { submittedAt: 'desc' }, take: 100 }),
    prisma.creatorModerationRequest.groupBy({ by: ['status'], orderBy: { status: 'asc' }, _count: { _all: true } }),
  ])
  return { items, counts: Object.fromEntries(grouped.map((row) => [row.status, row._count._all])) }
}

export async function getCreatorModeration(id: string) {
  const item = await getPrisma().creatorModerationRequest.findUnique({ where: { id }, select: {
    id: true, type: true, status: true, reason: true, submittedAt: true, reviewedAt: true,
    work: { select: { id: true, title: true, type: true, origin: true, status: true, category: true, rating: true, creationMethod: true, narrationType: true, tagline: true, synopsis: true, tags: true, originalTitle: true, originalAuthor: true, originalLanguage: true, translatorName: true, coverObjectKey: true, creator: { select: { id: true, name: true, email: true } }, episodes: { orderBy: { episodeNumber: 'asc' }, take: 5, select: { id: true, episodeNumber: true, title: true, type: true, status: true, priceCoins: true, content: true, durationSeconds: true, assets: { orderBy: { sortOrder: 'asc' }, select: { id: true, kind: true, contentType: true, sizeBytes: true, sortOrder: true } } } } } },
  } })
  if (!item) throw new CreatorModerationError('NOT_FOUND')
  const { coverObjectKey, ...work } = item.work
  return { ...item, work: { ...work, hasCover: Boolean(coverObjectKey) } }
}

export async function updateCreatorModerationNarration(input: { id: string; narrationType: 'human' | 'ai'; adminId: string }) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const item = await tx.creatorModerationRequest.findUnique({
      where: { id: input.id },
      select: { work: { select: { id: true, type: true } } },
    })
    if (!item) throw new CreatorModerationError('NOT_FOUND')
    if (item.work.type !== 'audiobook') throw new CreatorModerationError('VALIDATION')
    const work = await tx.creatorWork.update({
      where: { id: item.work.id },
      data: { narrationType: input.narrationType },
      select: { id: true, narrationType: true },
    })
    await tx.auditLog.create({
      data: {
        adminId: input.adminId,
        action: 'creator_moderation.narration_type.update',
        entity: 'CreatorWork',
        entityId: item.work.id,
        detail: { moderationRequestId: input.id, narrationType: input.narrationType },
      },
    })
    return work
  })
}

export async function decideCreatorModeration(input: { id: string; decision: 'approved' | 'rejected'; reason?: string; adminId: string }) {
  if (input.decision === 'rejected' && (!input.reason?.trim() || input.reason.trim().length > 500)) throw new CreatorModerationError('VALIDATION')
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const item = await tx.creatorModerationRequest.findUnique({ where: { id: input.id }, include: { work: { select: { id: true, status: true, approvedAt: true, publishedAt: true } } } })
    if (!item) throw new CreatorModerationError('NOT_FOUND')
    if (item.status !== 'pending') {
      if (item.status === input.decision) return item
      throw new CreatorModerationError('CONFLICT')
    }
    const claimed = await tx.creatorModerationRequest.updateMany({ where: { id: item.id, status: 'pending' }, data: { status: input.decision, reason: input.decision === 'rejected' ? input.reason!.trim() : null, reviewerId: input.adminId, reviewedAt: new Date() } })
    if (!claimed.count) {
      const latest = await tx.creatorModerationRequest.findUnique({ where: { id: item.id } })
      if (latest?.status === input.decision) return latest
      throw new CreatorModerationError('CONFLICT')
    }
    if (item.type === 'publication' || item.type === 'translation') {
      const workClaimed = await tx.creatorWork.updateMany({
        where: { id: item.workId, status: 'pending_review' },
        data: input.decision === 'approved'
          ? { status: 'approved', approvedAt: new Date(), rejectionReason: null, coverIsPublic: false }
          : { status: 'rejected', rejectionReason: input.reason!.trim(), approvedAt: null, coverIsPublic: false },
      })
      if (!workClaimed.count) throw new CreatorModerationError('CONFLICT')
    } else if (input.decision === 'approved') {
      await tx.creatorWork.update({ where: { id: item.workId }, data: { status: 'archived' } })
    } else {
      await tx.creatorWork.update({ where: { id: item.workId }, data: { status: item.work.publishedAt ? 'published' : item.work.approvedAt ? 'approved' : 'draft', rejectionReason: input.reason!.trim() } })
    }
    await tx.auditLog.create({ data: { adminId: input.adminId, action: `creator_moderation.${item.type}.${input.decision}`, entity: 'CreatorModerationRequest', entityId: item.id, detail: { workId: item.workId } } })
    return tx.creatorModerationRequest.findUniqueOrThrow({ where: { id: item.id } })
  })
}
