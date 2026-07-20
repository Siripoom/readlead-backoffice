export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { authorizeMember, creatorApiError, privateJson } from '@/lib/creator-api'
import { getCreatorDashboard } from '@/lib/db/creator-studio'
import type { CreatorWorkType } from '@/lib/generated/prisma/enums'

const TYPES = new Set(['all', 'novel', 'manga', 'audiobook'])
const METRICS = new Set(['coins', 'views', 'shelf', 'dailyVotes', 'monthlyVotes', 'reviews', 'comments', 'revenue'])
const SORTS = new Set(['published', 'recent', 'oldest', 'dailyVotes', 'monthlyVotes', 'views'])

export async function GET(request: NextRequest) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  const params = request.nextUrl.searchParams
  const type = TYPES.has(params.get('type') ?? '') ? params.get('type')! as CreatorWorkType | 'all' : 'all'
  const metric = METRICS.has(params.get('metric') ?? '') ? params.get('metric')! as Parameters<typeof getCreatorDashboard>[1]['metric'] : 'coins'
  const sort = SORTS.has(params.get('sort') ?? '') ? params.get('sort')! as Parameters<typeof getCreatorDashboard>[1]['sort'] : 'published'
  const now = new Date()
  const year = Math.min(now.getUTCFullYear() + 1, Math.max(2020, Number(params.get('year')) || now.getUTCFullYear()))
  const month = Math.min(12, Math.max(0, Number(params.get('month')) || now.getUTCMonth() + 1))
  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(params.get('pageSize')) || 10))
  try {
    return privateJson(await getCreatorDashboard(auth.user.id, { type, metric, sort, year, month, page, pageSize, query: (params.get('query') ?? '').trim().slice(0, 100) }))
  } catch (error) { return creatorApiError(error, 'โหลดแดชบอร์ดไม่สำเร็จ') }
}
