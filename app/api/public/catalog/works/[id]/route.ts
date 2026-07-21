export const dynamic = 'force-dynamic'

import { getPrisma } from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const work = await getPrisma().creatorWork.findFirst({
    where: {
      id: (await context.params).id,
      OR: [
        { status: 'approved' },
        { status: 'published', episodes: { some: { status: 'published' } } },
      ],
    },
    select: {
      id: true, type: true, origin: true, status: true, title: true, category: true, rating: true, creationMethod: true, narrationType: true, tagline: true, synopsis: true, tags: true, seriesStatus: true, approvedAt: true, publishedAt: true, updatedAt: true,
      coverObjectKey: true, coverIsPublic: true,
      views: true, coins: true, shelfCount: true, dailyVotes: true, monthlyVotes: true, reviewCount: true, commentCount: true,
      creator: { select: { id: true, name: true, writerApplication: { select: { penName: true } }, creatorProfile: { select: { followers: true } } } },
      episodes: { where: { status: 'published' }, orderBy: { episodeNumber: 'asc' }, select: { id: true, episodeNumber: true, title: true, type: true, priceCoins: true, publishedAt: true, durationSeconds: true } },
      reviews: { where: { status: 'published' }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, userId: true, rating: true, body: true, recommended: true, spoiler: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true } }, replies: { where: { status: 'published' }, orderBy: { createdAt: 'asc' }, select: { id: true, userId: true, body: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true } } } }, reactions: { select: { kind: true } } } },
      comments: { where: { status: 'published', parentId: null }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, body: true, createdAt: true, user: { select: { id: true, name: true } }, replies: { where: { status: 'published' }, select: { id: true, body: true, createdAt: true, user: { select: { id: true, name: true } } } } } },
    },
  })
  if (!work) return Response.json({ error: 'ไม่พบผลงาน' }, { status: 404 })
  const { coverObjectKey, coverIsPublic, status, reviews, comments, ...publicWork } = work
  const availability = status === 'approved' ? 'coming_soon' as const : 'published' as const
  const presented = {
    ...publicWork,
    availability,
    hasCover: Boolean(coverObjectKey) && (availability === 'coming_soon' || coverIsPublic),
    reviews: availability === 'coming_soon' ? [] : reviews.map(({ reactions, ...review }) => ({
      ...review,
      likes: reactions.filter((reaction) => reaction.kind === 'like').length,
      dislikes: reactions.filter((reaction) => reaction.kind === 'dislike').length,
    })),
    comments: availability === 'coming_soon' ? [] : comments,
  }
  return Response.json({ work: presented }, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } })
}
