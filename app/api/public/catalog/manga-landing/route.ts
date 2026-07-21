export const dynamic = 'force-dynamic'

import { getPrisma } from '@/lib/prisma'

const BOOK_LIMIT = 14
const CATEGORY_LIMIT = 18
const RANKING_LIMIT = 10
const LATEST_LIMIT = 24
const NEW_WORK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

const GENRE_FILTERS = {
  action: { categories: ['action'] },
  romance: { categories: ['romance'] },
  fantasy: { categories: ['fantasy'] },
  horror: { categories: ['horror'] },
  mystery: { categories: ['mystery'] },
  'time-travel': { categories: ['historical', 'fantasy'] },
  translated: { origin: 'translated' as const },
  'sci-fi': { categories: ['sci-fi'] },
  comedy: { categories: ['comedy'] },
  school: { categories: ['slice-of-life'] },
  'slice-of-life': { categories: ['slice-of-life'] },
  bl: { categories: ['bl'] },
  harem: { categories: ['romance'] },
  'martial-arts': { categories: ['action'] },
  historical: { categories: ['historical'] },
  game: { categories: ['fantasy', 'action'] },
  urban: { categories: ['slice-of-life'] },
  family: { categories: ['drama'] },
  superhero: { categories: ['action', 'sci-fi'] },
  adventure: { categories: ['action', 'fantasy'] },
  thriller: { categories: ['mystery', 'horror'] },
  youth: { categories: ['slice-of-life'] },
  market: { categories: ['slice-of-life', 'drama'] },
} as const

type MangaGenre = keyof typeof GENRE_FILTERS

function genreCondition(genre?: MangaGenre) {
  if (!genre) return {}
  const filter = GENRE_FILTERS[genre]
  return {
    ...('categories' in filter ? { category: { in: [...filter.categories] } } : {}),
    ...('origin' in filter ? { origin: filter.origin } : {}),
  }
}

function publishedWhere(genre?: MangaGenre) {
  return {
    type: 'manga' as const,
    status: 'published' as const,
    publishedAt: { not: null },
    episodes: { some: { status: 'published' as const } },
    ...genreCondition(genre),
  }
}

function approvedWhere(genre?: MangaGenre) {
  return {
    type: 'manga' as const,
    status: 'approved' as const,
    approvedAt: { not: null },
    ...genreCondition(genre),
  }
}

const cardSelect = {
  id: true,
  type: true,
  title: true,
  category: true,
  origin: true,
  originalLanguage: true,
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
    .slice(0, BOOK_LIMIT)
}

function regionalType(value: string | null) {
  if (!value) return null
  const normalized = value.normalize('NFKC').trim().toLocaleLowerCase('en-US')
  if (['ko', 'kor', 'korean', '한국어'].includes(normalized) || normalized.includes('เกาหลี')) return 'manhwa' as const
  if (['zh', 'zho', 'chi', 'chinese', '中文', '汉语', '漢語'].includes(normalized) || normalized.includes('จีน')) return 'manhua' as const
  return null
}

export async function GET(request: Request) {
  const genreParam = new URL(request.url).searchParams.get('genre')?.trim() ?? ''
  if (genreParam && !(genreParam in GENRE_FILTERS)) {
    return Response.json({ error: 'หมวดหมู่ไม่ถูกต้อง' }, { status: 400 })
  }
  const genre = genreParam ? genreParam as MangaGenre : undefined
  const published = publishedWhere(genre)
  const approved = approvedWhere(genre)
  const recentCutoff = new Date(Date.now() - NEW_WORK_WINDOW_MS)
  const prisma = getPrisma()

  const [
    newestPublished,
    newestApproved,
    popularCandidates,
    daily,
    monthly,
    newRankings,
    regionalCandidates,
    latestGroups,
  ] = await prisma.$transaction([
    prisma.creatorWork.findMany({
      where: published,
      select: cardSelect,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: BOOK_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: approved,
      select: cardSelect,
      orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
      take: BOOK_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: published,
      select: cardSelect,
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: CATEGORY_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: published,
      select: cardSelect,
      orderBy: [{ dailyVotes: 'desc' }, { views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: RANKING_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: published,
      select: cardSelect,
      orderBy: [{ monthlyVotes: 'desc' }, { views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: RANKING_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: { ...published, publishedAt: { gte: recentCutoff } },
      select: cardSelect,
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: RANKING_LIMIT,
    }),
    prisma.creatorWork.findMany({
      where: { ...published, originalLanguage: { not: null } },
      select: cardSelect,
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.creatorEpisode.groupBy({
      by: ['workId'],
      where: {
        status: 'published',
        publishedAt: { not: null },
        work: {
          type: 'manga',
          status: 'published',
          publishedAt: { not: null },
          ...genreCondition(genre),
        },
      },
      _max: { publishedAt: true },
      orderBy: [{ _max: { publishedAt: 'desc' } }, { workId: 'desc' }],
      take: LATEST_LIMIT,
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
          where: { id: { in: latestWorkIds }, ...published },
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

  const popular = popularCandidates.map(presentCard)
  const regional = regionalCandidates.map(presentCard)
  return Response.json({
    popular: popular.slice(0, BOOK_LIMIT),
    newReleases: newestCards(newestPublished, newestApproved),
    recommended: popular.slice(0, BOOK_LIMIT),
    categoryPopular: popular,
    manhwa: regional.filter((work) => regionalType(work.originalLanguage) === 'manhwa').slice(0, BOOK_LIMIT),
    manhua: regional.filter((work) => regionalType(work.originalLanguage) === 'manhua').slice(0, BOOK_LIMIT),
    rankings: {
      views: popular.slice(0, RANKING_LIMIT),
      daily: daily.map(presentCard),
      monthly: monthly.map(presentCard),
      new: newRankings.map(presentCard),
    },
    latestUpdates,
  }, {
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
  })
}
