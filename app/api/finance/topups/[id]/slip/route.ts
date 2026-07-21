export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { getCoinTopUpSlip } from '@/lib/db/coin-topups'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const auth = await authorizeApi('finance')
  if (!auth.ok) return auth.response
  const { id } = await context.params
  try {
    const url = await getCoinTopUpSlip(id, auth.admin.id)
    if (!url) return NextResponse.json({ error: 'ไม่พบหลักฐาน' }, { status: 404 })
    return NextResponse.redirect(url, { status: 307, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Top-up proof open failed', error)
    return NextResponse.json({ error: 'เปิดหลักฐานไม่สำเร็จ' }, { status: 500 })
  }
}
