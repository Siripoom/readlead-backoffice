export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { CoinTopUpReviewError, decideCoinTopUp, type CoinTopUpDecision } from '@/lib/db/coin-topups'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await authorizeApi('finance')
  if (!auth.ok) return auth.response
  const { id } = await context.params
  let body: { decision?: CoinTopUpDecision; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }
  if (body.decision !== 'approved' && body.decision !== 'rejected') {
    return NextResponse.json({ error: 'การตัดสินใจไม่ถูกต้อง' }, { status: 400 })
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (body.decision === 'rejected' && (!reason || reason.length > 500)) {
    return NextResponse.json({ error: 'กรุณาระบุเหตุผล 1–500 ตัวอักษร' }, { status: 400 })
  }
  try {
    return NextResponse.json(await decideCoinTopUp({
      id,
      decision: body.decision,
      reason: body.decision === 'rejected' ? reason : undefined,
      adminId: auth.admin.id,
    }), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof CoinTopUpReviewError) {
      if (error.code === 'NOT_FOUND') return NextResponse.json({ error: 'ไม่พบคำขอเติมเหรียญ' }, { status: 404 })
      if (error.code === 'INACTIVE_USER') return NextResponse.json({ error: 'ไม่สามารถเติมเหรียญให้บัญชีที่ไม่ใช้งาน' }, { status: 409 })
      return NextResponse.json({ error: 'คำขอนี้ถูกตัดสินแล้ว กรุณาโหลดข้อมูลใหม่' }, { status: 409 })
    }
    console.error('Top-up proof decision failed', error)
    return NextResponse.json({ error: 'บันทึกผลการตรวจสอบไม่สำเร็จ' }, { status: 500 })
  }
}
