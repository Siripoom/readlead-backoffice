export const dynamic = 'force-dynamic'
import { authorizeMember, privateJson } from '@/lib/creator-api'
import { getPrisma } from '@/lib/prisma'

export async function GET() {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  const prisma = getPrisma()
  const [account, purchases, shelves, reviews, comments, following, followers] = await Promise.all([
    prisma.coinAccount.findUnique({ where: { userId: auth.user.id }, select: { balance: true } }),
    prisma.episodePurchase.findMany({ where: { userId: auth.user.id }, orderBy: { purchasedAt: 'desc' }, take: 100, select: { id: true, coinsSpent: true, purchasedAt: true, work: { select: { id: true, title: true } }, episode: { select: { id: true, title: true } } } }),
    prisma.workShelf.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, work: { select: { id: true, type: true, title: true, category: true, tagline: true, updatedAt: true, creator: { select: { id: true, name: true, writerApplication: { select: { penName: true } } } } } } } }),
    prisma.workReview.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' }, select: { id: true, rating: true, body: true, status: true, createdAt: true, updatedAt: true, work: { select: { id: true, title: true } } } }),
    prisma.workComment.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' }, select: { id: true, body: true, status: true, createdAt: true, updatedAt: true, work: { select: { id: true, title: true } } } }),
    prisma.creatorFollow.count({ where: { followerId: auth.user.id } }),
    prisma.creatorFollow.count({ where: { creatorId: auth.user.id } }),
  ])
  return privateJson({ coinBalance: account?.balance ?? 0, purchases, shelves, activities: [...reviews.map((item) => ({ ...item, kind: 'review' as const })), ...comments.map((item) => ({ ...item, kind: 'comment' as const }))].sort((a, b) => +b.createdAt - +a.createdAt), following, followers })
}
