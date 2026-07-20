export const dynamic = 'force-dynamic'

import { authorizeMember, creatorApiError, privateJson } from '@/lib/creator-api'
import { createComment, deleteMemberActivity, simulateTopup, toggleCreatorFollow, toggleShelf, updateMemberActivity, upsertReview, voteForWork } from '@/lib/db/creator-interactions'

type Context = { params: Promise<{ action: string }> }

export async function POST(request: Request, context: Context) {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  const { action } = await context.params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  try {
    if (action === 'shelf' && typeof body.workId === 'string') return privateJson(await toggleShelf(auth.user.id, body.workId))
    if (action === 'follow' && typeof body.creatorId === 'string') return privateJson(await toggleCreatorFollow(auth.user.id, body.creatorId))
    if (action === 'review' && typeof body.workId === 'string') return privateJson({ review: await upsertReview(auth.user.id, body.workId, Number(body.rating), String(body.body ?? '')) })
    if (action === 'comment' && typeof body.workId === 'string') return privateJson({ comment: await createComment(auth.user.id, body.workId, String(body.body ?? ''), typeof body.parentId === 'string' ? body.parentId : undefined) }, 201)
    if (action === 'vote' && typeof body.workId === 'string' && (body.kind === 'daily' || body.kind === 'monthly')) return privateJson(await voteForWork(auth.user.id, body.workId, body.kind))
    if (action === 'simulate-topup') return privateJson(await simulateTopup(auth.user.id, Number(body.amount), String(body.idempotencyKey ?? '')))
    return privateJson({ error: 'คำสั่งไม่ถูกต้อง' }, 400)
  } catch (error) { return creatorApiError(error) }
}

export async function PATCH(request: Request, context: Context) {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  if ((await context.params).action !== 'activity') return privateJson({ error: 'คำสั่งไม่ถูกต้อง' }, 400)
  const body = await request.json().catch(() => ({})) as { kind?: string; id?: string; body?: string }
  if ((body.kind !== 'review' && body.kind !== 'comment') || !body.id || typeof body.body !== 'string') return privateJson({ error: 'ข้อมูลไม่ถูกต้อง' }, 400)
  try { return privateJson({ activity: await updateMemberActivity(auth.user.id, body.kind, body.id, body.body) }) } catch (error) { return creatorApiError(error) }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  if ((await context.params).action !== 'activity') return privateJson({ error: 'คำสั่งไม่ถูกต้อง' }, 400)
  const body = await request.json().catch(() => ({})) as { kind?: string; id?: string }
  if ((body.kind !== 'review' && body.kind !== 'comment') || !body.id) return privateJson({ error: 'ข้อมูลไม่ถูกต้อง' }, 400)
  try { return privateJson({ activity: await deleteMemberActivity(auth.user.id, body.kind, body.id) }) } catch (error) { return creatorApiError(error) }
}
