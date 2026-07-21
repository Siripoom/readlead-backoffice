export const dynamic = 'force-dynamic'

import { getPrisma } from '@/lib/prisma'

const POPULAR_LIMIT = 14
const RANKING_LIMIT = 10
const NEW_WORK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

const publishedWorkWhere = {
  status: 'published' as const,
  publishedAt: { not: null },
  episodes: { some: { status: 'published' as const } },
}

const workSelect = {
  id: true,
  type: true,
  title: true,
  category: true,
  origin: true,
  tagline: true,
  views: true,
  dailyVotes: true,
  monthlyVotes: true,
  publishedAt: true,
  coverObjectKey: true,
  coverIsPublic: true,
  creator: {
    select: {
      name: true,
      writerApplication: { select: { penName: true } },
    },
  },
  _count: { select: { episodes: { where: { status: 'published' as const } } } },
} as const

function presentWork<T extends {
  coverObjectKey: string | null
  coverIsPublic: boolean
  _count: { episodes: number }
}>(work: T) {
  const { coverObjectKey, coverIsPublic, _count, ...publicWork } = work
  return {
    ...publicWork,
    episodeCount: _count.episodes,
    hasCover: Boolean(coverObjectKey) && coverIsPublic,
  }
}

export async function GET() {
  const prisma = getPrisma()
  const recentCutoff = new Date(Date.now() - NEW_WORK_WINDOW_MS)
  const [popular, daily, monthly, views, newWorks] = await prisma.$transaction([
    prisma.creatorWork.findMany({
      where: publishedWorkWhere,
      select: workSelect,
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: POPULAR_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: publishedWorkWhere,
      select: workSelect,
      orderBy: [{ dailyVotes: 'desc' }, { views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: RANKING_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: publishedWorkWhere,
      select: workSelect,
      orderBy: [{ monthlyVotes: 'desc' }, { views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: RANKING_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: publishedWorkWhere,
      select: workSelect,
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: RANKING_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: { ...publishedWorkWhere, publishedAt: { gte: recentCutoff } },
      select: workSelect,
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: RANKING_LIMIT,
    }),
  ])

  return Response.json({
    popular: popular.map(presentWork),
    rankings: {
      daily: daily.map(presentWork),
      monthly: monthly.map(presentWork),
      views: views.map(presentWork),
      new: newWorks.map(presentWork),
    },
  }, {
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
  })
}
