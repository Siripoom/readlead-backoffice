export const dynamic = 'force-dynamic'

import { authorizeMember, creatorApiError, privateJson } from '@/lib/creator-api'
import { deleteCreatorEpisode, updateCreatorEpisode, type CreatorEpisodeInput } from '@/lib/db/creator-studio'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Context) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null) as Partial<CreatorEpisodeInput> | null
  if (!body) return privateJson({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400)
  const input: Partial<CreatorEpisodeInput> = {}
  if (typeof body.title === 'string' && body.title.trim()) input.title = body.title.trim().slice(0, 200)
  if (typeof body.content === 'string' || body.content === null) input.content = body.content?.slice(0, 1_000_000)
  if (typeof body.priceCoins === 'number') input.priceCoins = Math.min(10_000, Math.max(0, Math.floor(body.priceCoins)))
  if (body.status && ['draft', 'scheduled', 'published', 'hidden'].includes(body.status)) input.status = body.status
  if (body.durationSeconds === null || typeof body.durationSeconds === 'number') input.durationSeconds = body.durationSeconds === null ? null : Math.max(0, Math.floor(body.durationSeconds))
  if (body.scheduledAt === null) input.scheduledAt = null
  else if (body.scheduledAt) { const scheduledAt = new Date(body.scheduledAt); if (Number.isNaN(scheduledAt.valueOf())) return privateJson({ error: 'วันเวลาเผยแพร่ไม่ถูกต้อง' }, 400); input.scheduledAt = scheduledAt }
  if (input.status === 'scheduled' && !input.scheduledAt) return privateJson({ error: 'กรุณาระบุวันเวลาเผยแพร่' }, 400)
  try { return privateJson({ episode: await updateCreatorEpisode(auth.user.id, (await context.params).id, input) }) } catch (error) { return creatorApiError(error, 'แก้ไขตอนไม่สำเร็จ') }
}

export async function DELETE(_request: Request, context: Context) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  try { return privateJson({ episode: await deleteCreatorEpisode(auth.user.id, (await context.params).id) }) } catch (error) { return creatorApiError(error, 'ลบตอนไม่สำเร็จ') }
}
