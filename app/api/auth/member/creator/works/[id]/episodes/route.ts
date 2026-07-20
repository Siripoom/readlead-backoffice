export const dynamic = 'force-dynamic'

import { authorizeMember, creatorApiError, privateJson } from '@/lib/creator-api'
import { createCreatorEpisodes, getCreatorWork, type CreatorEpisodeInput } from '@/lib/db/creator-studio'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  try { return privateJson({ items: (await getCreatorWork(auth.user.id, (await context.params).id)).episodes }) } catch (error) { return creatorApiError(error) }
}

export async function POST(request: Request, context: Context) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null) as { episodes?: CreatorEpisodeInput[] } | CreatorEpisodeInput | null
  const raw = body && 'episodes' in body && Array.isArray(body.episodes) ? body.episodes : body ? [body as CreatorEpisodeInput] : []
  const episodes = raw.slice(0, 50).filter((item) => item.title?.trim() && ['text', 'image', 'audio'].includes(item.type) && ['draft', 'scheduled', 'published', 'hidden'].includes(item.status)).map((item) => ({
    title: item.title.trim().slice(0, 200), type: item.type, status: item.status, priceCoins: Math.min(10_000, Math.max(0, Math.floor(Number(item.priceCoins) || 0))),
    content: item.content?.slice(0, 1_000_000), scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : null, durationSeconds: item.durationSeconds ? Math.max(0, Math.floor(item.durationSeconds)) : null,
  }))
  if (!episodes.length || episodes.some((item) => item.status === 'scheduled' && (!item.scheduledAt || Number.isNaN(item.scheduledAt.valueOf())))) return privateJson({ error: 'ข้อมูลตอนไม่ถูกต้อง' }, 400)
  try { return privateJson({ episodes: await createCreatorEpisodes(auth.user.id, (await context.params).id, episodes) }, 201) } catch (error) { return creatorApiError(error, 'สร้างตอนไม่สำเร็จ') }
}
