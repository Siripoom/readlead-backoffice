import { getMemberSessionUser } from '@/lib/member-auth'
import { CreatorStudioError } from '@/lib/db/creator-studio'
import { WriterApplicationEncryptionConfigError } from '@/lib/writer-application-crypto'

export async function authorizeMember(options?: { creator?: boolean }) {
  const user = await getMemberSessionUser()
  if (!user) return { ok: false as const, response: privateJson({ error: 'กรุณาเข้าสู่ระบบ' }, 401) }
  if (options?.creator && user.userType !== 'creator') return { ok: false as const, response: privateJson({ error: 'บัญชีนี้ยังไม่มีสิทธิ์นักเขียน' }, 403) }
  return { ok: true as const, user }
}

export function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export function creatorApiError(error: unknown, fallback = 'ดำเนินการไม่สำเร็จ') {
  if (error instanceof CreatorStudioError) {
    if (error.code === 'NOT_FOUND') return privateJson({ error: 'ไม่พบข้อมูลที่ร้องขอ' }, 404)
    if (error.code === 'FORBIDDEN') return privateJson({ error: 'ไม่มีสิทธิ์ดำเนินการ' }, 403)
    if (error.code === 'INSUFFICIENT_BALANCE') return privateJson({ error: 'ยอดคงเหลือไม่เพียงพอ' }, 409)
    if (error.code === 'INVALID_STATE') return privateJson({ error: 'สถานะข้อมูลไม่รองรับการดำเนินการนี้' }, 409)
    if (error.code === 'NOT_READY') return privateJson({ error: 'ข้อมูลหรือไฟล์ที่จำเป็นยังไม่พร้อมใช้งาน' }, 409)
    return privateJson({ error: 'ข้อมูลไม่ถูกต้อง' }, 400)
  }
  if (error instanceof WriterApplicationEncryptionConfigError) return privateJson({ error: 'ระบบถอดรหัสข้อมูลยังไม่พร้อมใช้งาน' }, 503)
  console.error('Creator API failed', error)
  return privateJson({ error: fallback }, 500)
}
