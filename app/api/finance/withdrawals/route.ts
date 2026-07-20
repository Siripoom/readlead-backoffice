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
  const body = await request.json() as { id?: string; status?: WithdrawalStatus; note?: string }
  if (!body.id || !body.status || !['approved', 'rejected'].includes(body.status)) return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 })
  if (body.status === 'rejected' && (!body.note?.trim() || body.note.trim().length > 500)) return NextResponse.json({ error: 'กรุณาระบุเหตุผล 1–500 ตัวอักษร' }, { status: 400 })
  try {
    const withdrawal = await updateWithdrawalStatus({ id: body.id, status: body.status, adminId: auth.admin.id, reviewerName: auth.admin.user.name, note: body.note?.trim() })
    return NextResponse.json(withdrawal)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return NextResponse.json({ error: message === 'NOT_FOUND' ? 'ไม่พบคำขอถอนเงิน' : message === 'CONFLICT' ? 'คำขอนี้ถูกตัดสินแล้ว' : 'ดำเนินการไม่สำเร็จ' }, { status: message === 'NOT_FOUND' ? 404 : message === 'CONFLICT' ? 409 : 500 })
  }
}
