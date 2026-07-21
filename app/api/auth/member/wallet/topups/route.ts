export const dynamic = 'force-dynamic'

import { authorizeMember, privateJson } from '@/lib/creator-api'
import { createMemberTopUp, MemberTopUpError } from '@/lib/member-topups'
import { BackblazeConfigError } from '@/lib/storage/backblaze'

export async function POST(request: Request) {
  const auth = await authorizeMember()
  if (!auth.ok) return auth.response
  try {
    const result = await createMemberTopUp(auth.user.id, await request.formData())
    return privateJson(result, result.idempotent ? 200 : 201)
  } catch (error) {
    if (error instanceof MemberTopUpError) return privateJson({ error: error.message }, error.status)
    if (error instanceof BackblazeConfigError) return privateJson({ error: 'ระบบจัดเก็บสลิปยังไม่พร้อมใช้งาน' }, 503)
    console.error('Member top-up submission failed', error)
    return privateJson({ error: 'ส่งหลักฐานไม่สำเร็จ กรุณาลองใหม่' }, 500)
  }
}
