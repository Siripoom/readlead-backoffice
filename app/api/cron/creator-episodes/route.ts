export const dynamic = 'force-dynamic'

import { publishDueCreatorEpisodes } from '@/lib/db/creator-studio'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return Response.json(await publishDueCreatorEpisodes())
  } catch (error) {
    console.error('Scheduled creator episode publication failed', error)
    return Response.json({ error: 'เผยแพร่ตอนที่ตั้งเวลาไม่สำเร็จ' }, { status: 500 })
  }
}
