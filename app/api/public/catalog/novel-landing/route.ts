export const dynamic = 'force-dynamic'

import { getPrisma } from '@/lib/prisma'

const NEW_WORK_LIMIT = 14
const POPULAR_LIMIT = 14
const RANKING_LIMIT = 10
const LATEST_UPDATE_LIMIT = 26
const NEW_WORK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

function publishedNovelWhere(category?: string) {
  return {
    type: 'novel' as const,
    status: 'published' as const,
    publishedAt: { not: null },
    episodes: { some: { status: 'published' as const } },
    ...(category ? { category } : {}),
  }
}

function approvedNovelWhere(category?: string) {
  return {
    type: 'novel' as const,
    status: 'approved' as const,
    approvedAt: { not: null },
    ...(category ? { category } : {}),
  }
}

const cardSelect = {
  id: true,
  type: true,
  title: true,
  category: true,
  origin: true,
  tagline: true,
  synopsis: true,
  views: true,
  dailyVotes: true,
  monthlyVotes: true,
  publishedAt: true,
  approvedAt: true,
  status: true,
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

function presentCard<T extends {
  id: string
  status: string
  approvedAt: Date | null
  publishedAt: Date | null
  coverObjectKey: string | null
  coverIsPublic: boolean
  _count: { episodes: number }
}>(work: T) {
  const { coverObjectKey, coverIsPublic, _count, status, approvedAt, publishedAt, ...card } = work
  const availability = status === 'approved' ? 'coming_soon' as const : 'published' as const
  return {
    ...card,
    publishedAt,
    availability,
    displayedAt: availability === 'coming_soon' ? approvedAt : publishedAt,
    episodeCount: _count.episodes,
    hasCover: Boolean(coverObjectKey) && (availability === 'coming_soon' || coverIsPublic),
  }
}

function newestCards<T extends Parameters<typeof presentCard>[0]>(...groups: T[][]) {
  return groups
    .flat()
    .map(presentCard)
    .filter((work): work is ReturnType<typeof presentCard> & { displayedAt: Date } => Boolean(work.displayedAt))
    .sort((a, b) => b.displayedAt.getTime() - a.displayedAt.getTime() || b.id.localeCompare(a.id))
    .slice(0, NEW_WORK_LIMIT)
}

export async function GET(request: Request) {
  const prisma = getPrisma()
  const categoryParam = new URL(request.url).searchParams.get('category')?.trim() ?? ''
  if (categoryParam.length > 100) {
    return Response.json({ error: 'หมวดหมู่ไม่ถูกต้อง' }, { status: 400 })
  }
  const category = categoryParam || undefined
  const publishedWhere = publishedNovelWhere(category)
  const approvedWhere = approvedNovelWhere(category)
  const recentCutoff = new Date(Date.now() - NEW_WORK_WINDOW_MS)
  const [
    publishedWorks,
    approvedWorks,
    publishedThaiWorks,
    approvedThaiWorks,
    publishedTranslatedWorks,
    approvedTranslatedWorks,
    categoryPopular,
    daily,
    monthly,
    views,
    newRankings,
    latestGroups,
  ] = await prisma.$transaction([
    prisma.creatorWork.findMany({
      where: publishedWhere,
      select: cardSelect,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: NEW_WORK_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: approvedWhere,
      select: cardSelect,
      orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
      take: NEW_WORK_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: { ...publishedWhere, origin: 'original' },
      select: cardSelect,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: NEW_WORK_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: { ...approvedWhere, origin: 'original' },
      select: cardSelect,
      orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
      take: NEW_WORK_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: { ...publishedWhere, origin: 'translated' },
      select: cardSelect,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: NEW_WORK_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: { ...approvedWhere, origin: 'translated' },
      select: cardSelect,
      orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
      take: NEW_WORK_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: publishedWhere,
      select: cardSelect,
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: POPULAR_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: publishedWhere,
      select: cardSelect,
      orderBy: [{ dailyVotes: 'desc' }, { views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: RANKING_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: publishedWhere,
      select: cardSelect,
      orderBy: [{ monthlyVotes: 'desc' }, { views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: RANKING_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: publishedWhere,
      select: cardSelect,
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: RANKING_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: { ...publishedWhere, publishedAt: { gte: recentCutoff } },
      select: cardSelect,
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: RANKING_LIMIT,
    }),
    prisma.creatorEpisode.groupBy({
      by: ['workId'],
      where: {
        status: 'published',
        publishedAt: { not: null },
        work: { type: 'novel', status: 'published', publishedAt: { not: null }, ...(category ? { category } : {}) },
      },
      _max: { publishedAt: true },
      orderBy: [{ _max: { publishedAt: 'desc' } }, { workId: 'desc' }],
      take: LATEST_UPDATE_LIMIT,
    }),
  ])

  const latestWorkIds = latestGroups.map((item) => item.workId)
  const latestDateFilters = latestGroups.flatMap((item) => {
    const publishedAt = item._max?.publishedAt
    return publishedAt ? [{ workId: item.workId, publishedAt }] : []
  })

  const [latestWorks, latestEpisodes] = latestWorkIds.length
    ? await prisma.$transaction([
        prisma.creatorWork.findMany({
          where: { id: { in: latestWorkIds }, ...publishedWhere },
          select: cardSelect,
        }),
        prisma.creatorEpisode.findMany({
          where: { status: 'published', OR: latestDateFilters },
          select: { id: true, workId: true, episodeNumber: true, title: true, publishedAt: true },
          orderBy: [{ episodeNumber: 'desc' }, { id: 'desc' }],
        }),
      ])
    : [[], []]

  const workById = new Map(latestWorks.map((work) => [work.id, work]))
  const episodeByWorkId = new Map<string, (typeof latestEpisodes)[number]>()
  for (const episode of latestEpisodes) {
    if (!episodeByWorkId.has(episode.workId)) episodeByWorkId.set(episode.workId, episode)
  }

  const latestUpdates = latestGroups.flatMap((group) => {
    const work = workById.get(group.workId)
    const latestEpisode = episodeByWorkId.get(group.workId)
    return work && latestEpisode ? [{ ...presentCard(work), latestEpisode }] : []
  })

  return Response.json({
    newWorks: newestCards(publishedWorks, approvedWorks),
    newThaiWorks: newestCards(publishedThaiWorks, approvedThaiWorks),
    translatedWorks: newestCards(publishedTranslatedWorks, approvedTranslatedWorks),
    categoryPopular: categoryPopular.map(presentCard),
    popular: categoryPopular.map(presentCard),
    rankings: {
      daily: daily.map(presentCard),
      monthly: monthly.map(presentCard),
      views: views.map(presentCard),
      new: newRankings.map(presentCard),
    },
    latestUpdates,
  }, {
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
  })
}
