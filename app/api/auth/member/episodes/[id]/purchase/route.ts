export const dynamic = 'force-dynamic'

import { authorizeMember, creatorApiError, privateJson } from '@/lib/creator-api'
import { purchaseEpisode } from '@/lib/db/creator-interactions'
import { getMemberSessionUser } from '@/lib/member-auth'
import { getPrisma } from '@/lib/prisma'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const user = await getMemberSessionUser()
  const id = (await context.params).id
  const episode = await getPrisma().creatorEpisode.findUnique({ where: { id }, select: {
    id: true, workId: true, episodeNumber: true, title: true, type: true, status: true, priceCoins: true, content: true, scheduledAt: true, publishedAt: true, durationSeconds: true,
    work: { select: { creatorId: true, status: true } }, assets: { orderBy: { sortOrder: 'asc' }, select: { id: true, kind: true, contentType: true, sizeBytes: true, sortOrder: true, durationSeconds: true } },
  } })
  if (!episode || episode.status !== 'published' || episode.work.status !== 'published') return privateJson({ error: 'ไม่พบตอน' }, 404)
  const owner = user?.id === episode.work.creatorId
  const purchase = user && episode.priceCoins > 0 ? await getPrisma().episodePurchase.findUnique({ where: { userId_episodeId: { userId: user.id, episodeId: id } }, select: { id: true } }) : null
  if (episode.priceCoins > 0 && !owner && !purchase) return privateJson({ error: user ? 'กรุณาซื้อตอนนี้ก่อนอ่าน' : 'กรุณาเข้าสู่ระบบและซื้อตอนนี้ก่อนอ่าน' }, user ? 402 : 401)
  const { work: _work, ...safe } = episode
  void _work
  return privateJson({ episode: safe, purchased: Boolean(purchase) || owner || episode.priceCoins === 0 })
}

export async function POST(_request: Request, context: Context) {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  try { return privateJson(await purchaseEpisode(auth.user.id, (await context.params).id)) } catch (error) { return creatorApiError(error, 'ซื้อเนื้อหาไม่สำเร็จ') }
}
