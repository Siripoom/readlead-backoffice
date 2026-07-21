export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { listCoinTopUps, type CoinTopUpFilter } from '@/lib/db/coin-topups'

const FILTERS: CoinTopUpFilter[] = ['all', 'pending', 'approved', 'rejected']

export async function GET(request: NextRequest) {
  const auth = await authorizeApi('finance')
  if (!auth.ok) return auth.response
  const rawStatus = request.nextUrl.searchParams.get('status') ?? 'all'
  const status = FILTERS.includes(rawStatus as CoinTopUpFilter) ? rawStatus as CoinTopUpFilter : 'all'
  const query = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 120)
  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('pageSize') ?? '20', 10) || 20))
  try {
    return NextResponse.json(await listCoinTopUps({ status, query, page, pageSize }), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('Top-up proof list failed', error)
    return NextResponse.json({ error: 'โหลดรายการหลักฐานไม่สำเร็จ' }, { status: 500 })
  }
}
