export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import {
  decideWriterApplication,
  getWriterApplicationDetail,
  recordWriterApplicationAudit,
  WriterApplicationReviewError,
  type WriterApplicationDecision,
} from '@/lib/db/writer-applications'
import { WriterApplicationEncryptionConfigError } from '@/lib/writer-application-crypto'

type Context = { params: Promise<{ id: string }> }

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function GET(_request: NextRequest, context: Context) {
  const auth = await authorizeApi('users')
  if (!auth.ok) return auth.response
  const { id } = await context.params

  try {
    const application = await getWriterApplicationDetail(id)
    if (!application) return json({ error: 'ไม่พบใบสมัคร' }, 404)
    await recordWriterApplicationAudit({
      adminId: auth.admin.id,
      applicationId: id,
      action: 'writer_application.detail_viewed',
    })
    return json({ application })
  } catch (error) {
    if (error instanceof WriterApplicationEncryptionConfigError) return json({ error: 'ระบบถอดรหัสข้อมูลยังไม่พร้อมใช้งาน' }, 503)
    console.error('Writer application detail failed', error)
    return json({ error: 'โหลดรายละเอียดใบสมัครไม่สำเร็จ' }, 500)
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await authorizeApi('users')
  if (!auth.ok) return auth.response
  const { id } = await context.params

  let body: { decision?: WriterApplicationDecision; reason?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400)
  }
  if (body.decision !== 'approved' && body.decision !== 'rejected') return json({ error: 'การตัดสินใจไม่ถูกต้อง' }, 400)
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (body.decision === 'rejected' && (!reason || reason.length > 500)) {
    return json({ error: 'กรุณาระบุเหตุผลในการปฏิเสธไม่เกิน 500 ตัวอักษร' }, 400)
  }

  try {
    const result = await decideWriterApplication({
      id,
      decision: body.decision,
      reason: body.decision === 'rejected' ? reason : undefined,
      adminId: auth.admin.id,
    })
    return json(result)
  } catch (error) {
    if (error instanceof WriterApplicationReviewError) {
      if (error.code === 'NOT_FOUND') return json({ error: 'ไม่พบใบสมัคร' }, 404)
      if (error.code === 'INACTIVE_USER') return json({ error: 'ไม่สามารถอนุมัติบัญชีที่ถูกระงับหรือไม่ใช้งาน' }, 409)
      return json({ error: 'สถานะใบสมัครถูกเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลใหม่' }, 409)
    }
    console.error('Writer application decision failed', error)
    return json({ error: 'บันทึกผลการตรวจสอบไม่สำเร็จ' }, 500)
  }
}
