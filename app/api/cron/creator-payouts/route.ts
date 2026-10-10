export const dynamic = 'force-dynamic'
import { timingSafeEqual } from 'node:crypto'
import { createAutomaticWithdrawalRequests } from '@/lib/db/creator-studio'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const received = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(secret ? `Bearer ${secret}` : '')
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await createAutomaticWithdrawalRequests()
    const failures = result.results.filter((item) => item.skipped === 'error')
    if (failures.length) {
      console.error('Automatic creator payout partially failed', { failedCount: failures.length })
      return Response.json(result, { status: 500 })
    }
    return Response.json(result)
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'INVALID_STATE') return Response.json({ error: 'งานนี้ทำงานเฉพาะวันที่ 25 UTC' }, { status: 409 })
    console.error('Automatic creator payout failed', error)
    return Response.json({ error: 'สร้างรอบจ่ายอัตโนมัติไม่สำเร็จ' }, { status: 500 })
  }
}
