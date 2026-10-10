export const dynamic = 'force-dynamic'

import { timingSafeEqual } from 'node:crypto'
import { publishDueCreatorEpisodes } from '@/lib/db/creator-studio'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const received = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(secret ? `Bearer ${secret}` : '')
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return Response.json(await publishDueCreatorEpisodes())
  } catch (error) {
    console.error('Scheduled creator episode publication failed', error)
    return Response.json({ error: 'เผยแพร่ตอนที่ตั้งเวลาไม่สำเร็จ' }, { status: 500 })
  }
}
