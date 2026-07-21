export const dynamic = 'force-dynamic'
import { authorizeApi } from '@/lib/auth'
import { CreatorModerationError, decideCreatorModeration, getCreatorModeration, updateCreatorModerationNarration } from '@/lib/db/creator-moderation'
import { getPrisma } from '@/lib/prisma'
type Context = { params: Promise<{ id: string }> }

function failure(error: unknown) {
  if (error instanceof CreatorModerationError) return Response.json({ error: error.code === 'NOT_FOUND' ? 'ไม่พบคำขอ' : error.code === 'VALIDATION' ? 'กรุณาระบุเหตุผล 1–500 ตัวอักษร' : 'คำขอนี้ถูกตัดสินแล้ว' }, { status: error.code === 'NOT_FOUND' ? 404 : error.code === 'VALIDATION' ? 400 : 409 })
  console.error('Creator moderation failed', error instanceof Error ? error.name : 'UnknownError')
  return Response.json({ error: 'ดำเนินการไม่สำเร็จ' }, { status: 500 })
}

export async function GET(_request: Request, context: Context) {
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  try {
    const id = (await context.params).id
    const detail = await getCreatorModeration(id)
    await getPrisma().auditLog.create({ data: { adminId: auth.admin.id, action: 'creator_moderation.open', entity: 'CreatorModerationRequest', entityId: id } })
    return Response.json(detail, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return failure(error) }
}

export async function PATCH(request: Request, context: Context) {
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({})) as { decision?: string; reason?: string; narrationType?: string }
  const id = (await context.params).id
  if (body.narrationType === 'human' || body.narrationType === 'ai') {
    try { return Response.json({ work: await updateCreatorModerationNarration({ id, narrationType: body.narrationType, adminId: auth.admin.id }) }) } catch (error) { return failure(error) }
  }
  if (body.decision !== 'approved' && body.decision !== 'rejected') return Response.json({ error: 'รูปแบบการตัดสินใจไม่ถูกต้อง' }, { status: 400 })
  try { return Response.json({ request: await decideCreatorModeration({ id, decision: body.decision, reason: body.reason, adminId: auth.admin.id }) }) } catch (error) { return failure(error) }
}
