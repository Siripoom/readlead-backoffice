export const dynamic = 'force-dynamic'

import { authorizeMember, privateJson } from '@/lib/creator-api'
import { getMemberReport, MemberReportError, replyToMemberReport } from '@/lib/member-reports'
import { BackblazeConfigError } from '@/lib/storage/backblaze'

function reportError(error: unknown, fallback: string) {
  if (error instanceof MemberReportError) return privateJson({ error: error.message }, error.status)
  if (error instanceof BackblazeConfigError) return privateJson({ error: 'ระบบจัดเก็บรูปภาพยังไม่พร้อมใช้งาน' }, 503)
  console.error('Member report detail API failed', error)
  return privateJson({ error: fallback }, 500)
}

export async function GET(_request: Request, context: RouteContext<'/api/auth/member/reports/[id]'>) {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  try { return privateJson({ report: await getMemberReport(auth.user.id, (await context.params).id) }) }
  catch (error) { return reportError(error, 'โหลดรายละเอียดไม่สำเร็จ') }
}

export async function POST(request: Request, context: RouteContext<'/api/auth/member/reports/[id]'>) {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  try { return privateJson({ report: await replyToMemberReport(auth.user, (await context.params).id, await request.formData()) }, 201) }
  catch (error) { return reportError(error, 'ส่งข้อความไม่สำเร็จ กรุณาลองใหม่') }
}
