export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { getCoinTopUpSlip } from '@/lib/db/coin-topups'
import { downloadTopUpProof } from '@/lib/storage/backblaze'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const auth = await authorizeApi('finance')
  if (!auth.ok) return auth.response
  const { id } = await context.params
  try {
    const slip = await getCoinTopUpSlip(id, auth.admin.id)
    if (!slip) return NextResponse.json({ error: 'ไม่พบหลักฐาน' }, { status: 404 })
    if (slip.contentType !== 'image/jpeg' && slip.contentType !== 'image/png') throw new Error('Unsupported slip content type')
    const bytes = await downloadTopUpProof(slip.key, slip.legacy)
    await slip.audit()
    return new Response(Buffer.from(bytes), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': slip.contentType,
        'Content-Disposition': `inline; filename="topup-slip.${slip.contentType === 'image/png' ? 'png' : 'jpg'}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Top-up proof open failed', error)
    return NextResponse.json({ error: 'เปิดหลักฐานไม่สำเร็จ' }, { status: 500 })
  }
}
