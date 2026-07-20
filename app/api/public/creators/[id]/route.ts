export const dynamic = 'force-dynamic'
import { getPrisma } from '@/lib/prisma'
type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const id = (await context.params).id
  const creator = await getPrisma().user.findFirst({ where: { id, userType: 'creator', status: 'active' }, select: {
    id: true, name: true, joinedAt: true, creatorProfile: { select: { followers: true } }, writerApplication: { select: { penName: true } },
    creatorWorks: { where: { status: 'published', episodes: { some: { status: 'published' } } }, orderBy: { updatedAt: 'desc' }, select: { id: true, type: true, title: true, category: true, tagline: true, synopsis: true, tags: true, origin: true, seriesStatus: true, views: true, dailyVotes: true, monthlyVotes: true, reviewCount: true, updatedAt: true, _count: { select: { episodes: { where: { status: 'published' } } } } } },
    _count: { select: { followedCreators: true, followers: true } },
  } })
  if (!creator) return Response.json({ error: 'ไม่พบโปรไฟล์นักเขียน' }, { status: 404 })
  return Response.json({ creator }, { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } })
}
