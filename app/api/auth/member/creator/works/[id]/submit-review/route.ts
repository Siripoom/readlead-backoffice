export const dynamic = 'force-dynamic'

import { authorizeMember, creatorApiError, privateJson } from '@/lib/creator-api'
import { submitCreatorWorkForReview } from '@/lib/db/creator-studio'

export async function POST(_request: Request, context: RouteContext<'/api/auth/member/creator/works/[id]/submit-review'>) {
  const auth = await authorizeMember({ creator: true })
  if (!auth.ok) return auth.response
  try {
    return privateJson({ request: await submitCreatorWorkForReview(auth.user.id, (await context.params).id) })
  } catch (error) {
    return creatorApiError(error, 'ส่งผลงานให้ตรวจสอบไม่สำเร็จ')
  }
}
