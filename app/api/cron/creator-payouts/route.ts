export const dynamic = 'force-dynamic'
import { createAutomaticWithdrawalRequests } from '@/lib/db/creator-studio'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try { return Response.json(await createAutomaticWithdrawalRequests()) }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'INVALID_STATE') return Response.json({ error: 'งานนี้ทำงานเฉพาะวันที่ 25 UTC' }, { status: 409 })
    console.error('Automatic creator payout failed', error)
    return Response.json({ error: 'สร้างรอบจ่ายอัตโนมัติไม่สำเร็จ' }, { status: 500 })
  }
}
