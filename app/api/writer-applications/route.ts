export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { listWriterApplications, type WriterApplicationFilter } from '@/lib/db/writer-applications'

const STATUSES = new Set<WriterApplicationFilter>(['all', 'pending', 'approved', 'rejected'])

export async function GET(request: NextRequest) {
  const auth = await authorizeApi('users')
  if (!auth.ok) return auth.response

  const rawStatus = request.nextUrl.searchParams.get('status') ?? 'pending'
  if (!STATUSES.has(rawStatus as WriterApplicationFilter)) {
    return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 })
  }
  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('pageSize') ?? '20', 10) || 20))
  const query = (request.nextUrl.searchParams.get('query') ?? '').trim().slice(0, 100)

  try {
    const result = await listWriterApplications({
      status: rawStatus as WriterApplicationFilter,
      query,
      page,
      pageSize,
    })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Writer application list failed', error)
    return NextResponse.json({ error: 'โหลดรายการใบสมัครไม่สำเร็จ' }, { status: 500 })
  }
}
