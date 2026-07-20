export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getPrisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const type = ['novel', 'manga', 'audiobook'].includes(params.get('type') ?? '') ? params.get('type')! as 'novel' | 'manga' | 'audiobook' : undefined
  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(params.get('pageSize')) || 20))
  const query = (params.get('query') ?? '').trim().slice(0, 100)
  const where = { status: 'published' as const, episodes: { some: { status: 'published' as const } }, ...(type ? { type } : {}), ...(query ? { title: { contains: query, mode: 'insensitive' as const } } : {}) }
  const prisma = getPrisma()
  const [total, items] = await prisma.$transaction([
    prisma.creatorWork.count({ where }),
    prisma.creatorWork.findMany({
      where,
      select: { id: true, type: true, title: true, category: true, rating: true, tagline: true, seriesStatus: true, publishedAt: true, updatedAt: true, views: true, shelfCount: true, dailyVotes: true, monthlyVotes: true, reviewCount: true, creator: { select: { id: true, name: true, writerApplication: { select: { penName: true } } } }, _count: { select: { episodes: { where: { status: 'published' } } } } },
      orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
    }),
  ])
  return Response.json({ items, total, page, pageSize }, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } })
}
