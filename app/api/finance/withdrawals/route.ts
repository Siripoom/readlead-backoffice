export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getWithdrawalDetail, getWithdrawalRequests, updateWithdrawalStatus } from '@/lib/db/finance'
import type { WithdrawalStatus } from '@/lib/generated/prisma/enums'
import { authorizeApi } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await authorizeApi('finance'); if (!auth.ok) return auth.response
  const id = request.nextUrl.searchParams.get('id')
  if (id) {
    try {
      const detail = await getWithdrawalDetail(id, auth.admin.id)
      return detail ? NextResponse.json(detail, { headers: { 'Cache-Control': 'private, no-store' } }) : NextResponse.json({ error: 'ไม่พบคำขอถอนเงิน' }, { status: 404 })
    } catch (error) {
      console.error('Withdrawal detail failed', error instanceof Error ? error.name : 'UnknownError')
      return NextResponse.json({ error: 'เปิดรายละเอียดบัญชีไม่สำเร็จ' }, { status: 503 })
    }
  }
  const withdrawals = await getWithdrawalRequests()
  return NextResponse.json(withdrawals, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeApi('finance'); if (!auth.ok) return auth.response
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 })
  const input = body as Record<string, unknown>
  if (typeof input.id !== 'string' || !input.id.trim() || (input.status !== 'approved' && input.status !== 'rejected') || (input.note !== undefined && typeof input.note !== 'string')) return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 })
  const note = typeof input.note === 'string' ? input.note.trim() : undefined
  if (input.status === 'rejected' && (!note || note.length > 500)) return NextResponse.json({ error: 'กรุณาระบุเหตุผล 1–500 ตัวอักษร' }, { status: 400 })
  try {
    const withdrawal = await updateWithdrawalStatus({ id: input.id, status: input.status as WithdrawalStatus, adminId: auth.admin.id, reviewerName: auth.admin.user.name, note })
    return NextResponse.json(withdrawal)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return NextResponse.json({ error: message === 'NOT_FOUND' ? 'ไม่พบคำขอถอนเงิน' : message === 'CONFLICT' ? 'คำขอนี้ถูกตัดสินแล้ว' : 'ดำเนินการไม่สำเร็จ' }, { status: message === 'NOT_FOUND' ? 404 : message === 'CONFLICT' ? 409 : 500 })
  }
}
