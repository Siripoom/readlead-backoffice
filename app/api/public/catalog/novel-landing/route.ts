export const dynamic = 'force-dynamic'

import { getPrisma } from '@/lib/prisma'

const NEW_WORK_LIMIT = 14
const LATEST_UPDATE_LIMIT = 26

const publishedNovelWhere = {
  type: 'novel' as const,
  status: 'published' as const,
  publishedAt: { not: null },
  episodes: { some: { status: 'published' as const } },
}

const approvedNovelWhere = {
  type: 'novel' as const,
  status: 'approved' as const,
  approvedAt: { not: null },
}

const cardSelect = {
  id: true,
  title: true,
  category: true,
  origin: true,
  tagline: true,
  synopsis: true,
  views: true,
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

export async function GET() {
  const prisma = getPrisma()
  const [publishedWorks, approvedWorks, publishedThaiWorks, approvedThaiWorks, latestGroups] = await prisma.$transaction([
    prisma.creatorWork.findMany({
      where: publishedNovelWhere,
      select: cardSelect,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: NEW_WORK_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: approvedNovelWhere,
      select: cardSelect,
      orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
      take: NEW_WORK_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: { ...publishedNovelWhere, origin: 'original' },
      select: cardSelect,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: NEW_WORK_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: { ...approvedNovelWhere, origin: 'original' },
      select: cardSelect,
      orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
      take: NEW_WORK_LIMIT,
    }),
    prisma.creatorEpisode.groupBy({
      by: ['workId'],
      where: {
        status: 'published',
        publishedAt: { not: null },
        work: { type: 'novel', status: 'published', publishedAt: { not: null } },
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
          where: { id: { in: latestWorkIds }, ...publishedNovelWhere },
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
    latestUpdates,
  }, {
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
  })
}
