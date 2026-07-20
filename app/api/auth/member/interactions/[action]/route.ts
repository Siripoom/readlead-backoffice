export const dynamic = 'force-dynamic'

import { authorizeMember, creatorApiError, privateJson } from '@/lib/creator-api'
import { createComment, createReviewReply, deleteMemberActivity, deleteReviewReply, getInteractionState, simulateTopup, toggleCreatorFollow, toggleReviewReaction, toggleShelf, updateMemberActivity, updateReview, updateReviewReply, upsertReview, voteForWork } from '@/lib/db/creator-interactions'

type Context = { params: Promise<{ action: string }> }

export async function GET(request: Request, context: Context) {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  if ((await context.params).action !== 'state') return privateJson({ error: 'คำสั่งไม่ถูกต้อง' }, 400)
  const workId = new URL(request.url).searchParams.get('workId')
  if (!workId) return privateJson({ error: 'ข้อมูลไม่ถูกต้อง' }, 400)
  try { return privateJson(await getInteractionState(auth.user.id, workId)) } catch (error) { return creatorApiError(error) }
}

export async function POST(request: Request, context: Context) {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  const { action } = await context.params
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  try {
    if (action === 'shelf' && typeof body.workId === 'string') return privateJson(await toggleShelf(auth.user.id, body.workId))
    if (action === 'follow' && typeof body.creatorId === 'string') return privateJson(await toggleCreatorFollow(auth.user.id, body.creatorId))
    if (action === 'review' && typeof body.workId === 'string') return privateJson({ review: await upsertReview(auth.user.id, body.workId, Number(body.rating), String(body.body ?? ''), body.recommended !== false, body.spoiler === true) })
    if (action === 'review-reply' && typeof body.reviewId === 'string') return privateJson({ reply: await createReviewReply(auth.user.id, body.reviewId, String(body.body ?? '')) }, 201)
    if (action === 'review-reaction' && typeof body.reviewId === 'string' && (body.kind === 'like' || body.kind === 'dislike')) return privateJson({ reaction: await toggleReviewReaction(auth.user.id, body.reviewId, body.kind) })
    if (action === 'comment' && typeof body.workId === 'string') return privateJson({ comment: await createComment(auth.user.id, body.workId, String(body.body ?? ''), typeof body.parentId === 'string' ? body.parentId : undefined) }, 201)
    if (action === 'vote' && typeof body.workId === 'string' && (body.kind === 'daily' || body.kind === 'monthly')) return privateJson(await voteForWork(auth.user.id, body.workId, body.kind, Number(body.amount), String(body.requestId ?? '')))
    if (action === 'simulate-topup') return privateJson(await simulateTopup(auth.user.id, String(body.packageId ?? ''), String(body.paymentMethod ?? ''), String(body.idempotencyKey ?? '')))
    return privateJson({ error: 'คำสั่งไม่ถูกต้อง' }, 400)
  } catch (error) { return creatorApiError(error) }
}

export async function PATCH(request: Request, context: Context) {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  const action = (await context.params).action
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  try {
    if (action === 'review' && typeof body.id === 'string') return privateJson({ review: await updateReview(auth.user.id, { id: body.id, rating: Number(body.rating), body: String(body.body ?? ''), recommended: body.recommended !== false, spoiler: body.spoiler === true }) })
    if (action === 'review-reply' && typeof body.id === 'string') return privateJson({ reply: await updateReviewReply(auth.user.id, body.id, String(body.body ?? '')) })
    if (action === 'activity' && (body.kind === 'review' || body.kind === 'comment') && typeof body.id === 'string' && typeof body.body === 'string') return privateJson({ activity: await updateMemberActivity(auth.user.id, body.kind, body.id, body.body) })
    return privateJson({ error: 'ข้อมูลไม่ถูกต้อง' }, 400)
  } catch (error) { return creatorApiError(error) }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  const action = (await context.params).action
  const body = await request.json().catch(() => ({})) as { kind?: string; id?: string }
  if (!body.id) return privateJson({ error: 'ข้อมูลไม่ถูกต้อง' }, 400)
  try {
    if (action === 'review') return privateJson({ review: await deleteMemberActivity(auth.user.id, 'review', body.id) })
    if (action === 'review-reply') return privateJson({ reply: await deleteReviewReply(auth.user.id, body.id) })
    if (action === 'activity' && (body.kind === 'review' || body.kind === 'comment')) return privateJson({ activity: await deleteMemberActivity(auth.user.id, body.kind, body.id) })
    return privateJson({ error: 'คำสั่งไม่ถูกต้อง' }, 400)
  } catch (error) { return creatorApiError(error) }
}
