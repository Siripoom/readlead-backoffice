export const dynamic = 'force-dynamic'
import { authorizeMember, privateJson } from '@/lib/creator-api'
import { getPrisma } from '@/lib/prisma'

export async function GET() {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  const prisma = getPrisma()
  const [account, episodePurchases, featurePurchases, shelves, reviews, comments, following, followers] = await Promise.all([
    prisma.coinAccount.findUnique({ where: { userId: auth.user.id }, select: { balance: true } }),
    prisma.episodePurchase.findMany({ where: { userId: auth.user.id }, orderBy: { purchasedAt: 'desc' }, take: 100, select: { id: true, coinsSpent: true, purchasedAt: true, work: { select: { id: true, title: true } }, episode: { select: { id: true, title: true } } } }),
    prisma.workFeaturePurchase.findMany({ where: { userId: auth.user.id }, orderBy: { purchasedAt: 'desc' }, take: 100, select: { id: true, feature: true, coinsSpent: true, purchasedAt: true, work: { select: { id: true, title: true } } } }),
    prisma.workShelf.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, work: { select: { id: true, type: true, title: true, category: true, tagline: true, updatedAt: true, creator: { select: { id: true, name: true, writerApplication: { select: { penName: true } } } } } } } }),
    prisma.workReview.findMany({
      where: { userId: auth.user.id, status: { not: 'deleted' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, rating: true, body: true, status: true, createdAt: true, updatedAt: true,
        work: { select: { id: true, title: true } },
        replies: {
          where: { status: 'published' }, orderBy: { createdAt: 'asc' },
          select: { id: true, body: true, createdAt: true, user: { select: { id: true, name: true, userType: true } } },
        },
        _count: { select: { reactions: { where: { kind: 'like' } } } },
      },
    }),
    prisma.workComment.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, body: true, status: true, createdAt: true, updatedAt: true,
        work: { select: { id: true, title: true } },
        replies: {
          where: { status: 'published' }, orderBy: { createdAt: 'asc' },
          select: { id: true, body: true, createdAt: true, user: { select: { id: true, name: true, userType: true } } },
        },
      },
    }),
    prisma.creatorFollow.count({ where: { followerId: auth.user.id } }),
    prisma.creatorFollow.count({ where: { creatorId: auth.user.id } }),
  ])
  const purchases = [
    ...episodePurchases.map((item) => ({ ...item, kind: 'episode' as const })),
    ...featurePurchases.map((item) => ({ ...item, kind: 'feature' as const, episode: null })),
  ].sort((a, b) => +b.purchasedAt - +a.purchasedAt).slice(0, 100)
  const activityIds = [...reviews.map((item) => item.id), ...comments.map((item) => item.id)]
  const expEntries = activityIds.length ? await prisma.expLedger.findMany({
    where: { userId: auth.user.id, referenceId: { in: activityIds } },
    orderBy: { createdAt: 'desc' },
    select: { referenceId: true, amount: true, status: true, reason: true },
  }) : []
  const expByActivity = new Map<string, (typeof expEntries)[number]>()
  for (const entry of expEntries) if (entry.referenceId && !expByActivity.has(entry.referenceId)) expByActivity.set(entry.referenceId, entry)

  const presentReplies = (items: Array<{ id: string; body: string; createdAt: Date; user: { id: string; name: string; userType: string } }>) => items.map((reply) => ({
    id: reply.id,
    body: reply.body,
    createdAt: reply.createdAt,
    user: { id: reply.user.id, name: reply.user.name, isStaff: reply.user.userType === 'admin' },
  }))
  const reviewStatus = (rawStatus: string, expStatus?: string) => {
    if (expStatus === 'pending') return 'pending'
    if (expStatus === 'granted') return 'approved'
    if (expStatus === 'rejected' || expStatus === 'revoked') return 'rejected'
    if (rawStatus === 'pending') return 'pending'
    if (rawStatus === 'rejected') return 'rejected'
    return 'approved'
  }
  const commentStatus = (rawStatus: string, expStatus?: string) => rawStatus === 'rejected' || expStatus === 'rejected' || expStatus === 'revoked' ? 'revoked' : 'normal'
  const activities = [
    ...reviews.map((item) => {
      const exp = expByActivity.get(item.id)
      return {
        id: item.id, kind: 'review' as const, rating: item.rating, body: item.body,
        status: reviewStatus(item.status, exp?.status), rawStatus: item.status,
        replyCount: item.replies.length, likes: item._count.reactions, replies: presentReplies(item.replies),
        exp: exp ? { amount: exp.amount, status: exp.status, reason: exp.reason } : null,
        createdAt: item.createdAt, updatedAt: item.updatedAt, work: item.work,
      }
    }),
    ...comments.map((item) => {
      const exp = expByActivity.get(item.id)
      return {
        id: item.id, kind: 'comment' as const, body: item.body,
        status: commentStatus(item.status, exp?.status), rawStatus: item.status,
        replyCount: item.replies.length, likes: 0, replies: presentReplies(item.replies),
        exp: exp ? { amount: exp.amount, status: exp.status, reason: exp.reason } : null,
        createdAt: item.createdAt, updatedAt: item.updatedAt, work: item.work,
      }
    }),
  ].sort((a, b) => +b.createdAt - +a.createdAt)

  return privateJson({ coinBalance: account?.balance ?? 0, purchases, shelves, activities, following, followers })
}
