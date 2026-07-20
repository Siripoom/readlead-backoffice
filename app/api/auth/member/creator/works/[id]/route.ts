export const dynamic = 'force-dynamic'

import { authorizeMember, creatorApiError, privateJson } from '@/lib/creator-api'
import { getCreatorWork, requestCreatorWorkDeletion, updateCreatorWork, type CreatorWorkInput } from '@/lib/db/creator-studio'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  try { return privateJson({ work: await getCreatorWork(auth.user.id, (await context.params).id) }) } catch (error) { return creatorApiError(error) }
}

export async function PATCH(request: Request, context: Context) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null) as Partial<CreatorWorkInput> | null
  if (!body) return privateJson({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400)
  const allowed: Partial<CreatorWorkInput> = {}
  for (const key of ['title', 'category', 'rating', 'creationMethod', 'tagline', 'synopsis', 'seriesStatus', 'originalAuthor', 'translatorName', 'originalLanguage', 'originalTitle'] as const) if (typeof body[key] === 'string') allowed[key] = body[key]
  if (Array.isArray(body.tags)) allowed.tags = body.tags.map(String).slice(0, 10)
  try { return privateJson({ work: await updateCreatorWork(auth.user.id, (await context.params).id, allowed) }) } catch (error) { return creatorApiError(error, 'แก้ไขผลงานไม่สำเร็จ') }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({})) as { reason?: string }
  const reason = body.reason?.trim() ?? ''
  if (!reason || reason.length > 500) return privateJson({ error: 'กรุณาระบุเหตุผลไม่เกิน 500 ตัวอักษร' }, 400)
  try { return privateJson({ request: await requestCreatorWorkDeletion(auth.user.id, (await context.params).id, reason) }) } catch (error) { return creatorApiError(error, 'ส่งคำขอลบไม่สำเร็จ') }
}
