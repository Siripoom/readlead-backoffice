export const dynamic = 'force-dynamic'

import { getPrisma } from '@/lib/prisma'

const LATEST_UPDATE_LIMIT = 26

const cardSelect = {
  id: true,
  type: true,
  title: true,
  category: true,
  origin: true,
  tagline: true,
  synopsis: true,
  views: true,
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

export async function GET() {
  const prisma = getPrisma()
  const latestGroups = await prisma.creatorEpisode.groupBy({
    by: ['workId'],
    where: {
      status: 'published',
      publishedAt: { not: null },
      work: {
        status: 'published',
        publishedAt: { not: null },
        type: { in: ['novel', 'manga', 'audiobook'] },
      },
    },
    _max: { publishedAt: true },
    orderBy: [{ _max: { publishedAt: 'desc' } }, { workId: 'desc' }],
    take: LATEST_UPDATE_LIMIT,
  })

  const workIds = latestGroups.map((item) => item.workId)
  const latestDateFilters = latestGroups.flatMap((item) => {
    const publishedAt = item._max.publishedAt
    return publishedAt ? [{ workId: item.workId, publishedAt }] : []
  })

  const [works, episodes] = workIds.length
    ? await prisma.$transaction([
        prisma.creatorWork.findMany({
          where: {
            id: { in: workIds },
            status: 'published',
            publishedAt: { not: null },
            episodes: { some: { status: 'published' } },
          },
          select: cardSelect,
        }),
        prisma.creatorEpisode.findMany({
          where: { status: 'published', OR: latestDateFilters },
          select: { id: true, workId: true, episodeNumber: true, title: true, publishedAt: true },
          orderBy: [{ episodeNumber: 'desc' }, { id: 'desc' }],
        }),
      ])
    : [[], []]

  const workById = new Map(works.map((work) => [work.id, work]))
  const episodeByWorkId = new Map<string, (typeof episodes)[number]>()
  for (const episode of episodes) {
    if (!episodeByWorkId.has(episode.workId)) episodeByWorkId.set(episode.workId, episode)
  }

  const items = latestGroups.flatMap((group) => {
    const work = workById.get(group.workId)
    const latestEpisode = episodeByWorkId.get(group.workId)
    if (!work || !latestEpisode?.publishedAt) return []
    const { coverObjectKey, coverIsPublic, _count, ...presentedWork } = work
    return [{
      ...presentedWork,
      episodeCount: _count.episodes,
      hasCover: Boolean(coverObjectKey) && coverIsPublic,
      latestEpisode,
    }]
  })

  return Response.json({ items }, {
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
  })
}
