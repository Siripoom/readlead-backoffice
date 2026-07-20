export const dynamic = 'force-dynamic'

import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { getMemberSessionUser } from '@/lib/member-auth'
import { creatorApiError, privateJson } from '@/lib/creator-api'
import { recordWorkView } from '@/lib/db/creator-interactions'

type Context = { params: Promise<{ id: string }> }
const VIEW_COOKIE = 'rl_view_session'

export async function POST(_request: Request, context: Context) {
  const jar = await cookies()
  let session = jar.get(VIEW_COOKIE)?.value
  if (!session) {
    session = randomBytes(24).toString('base64url')
    jar.set(VIEW_COOKIE, session, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 365 * 24 * 60 * 60 })
  }
  const user = await getMemberSessionUser()
  const viewerKey = createHash('sha256').update(user?.id ?? session).digest('hex')
  try { return privateJson(await recordWorkView({ workId: (await context.params).id, userId: user?.id, viewerKey })) } catch (error) { return creatorApiError(error, 'บันทึกยอดอ่านไม่สำเร็จ') }
}
