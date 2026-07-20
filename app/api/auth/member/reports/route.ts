export const dynamic = 'force-dynamic'

import { authorizeMember, privateJson } from '@/lib/creator-api'
import { createMemberReport, listMemberReports, MemberReportError } from '@/lib/member-reports'
import { BackblazeConfigError } from '@/lib/storage/backblaze'

function reportError(error: unknown, fallback: string) {
  if (error instanceof MemberReportError) return privateJson({ error: error.message }, error.status)
  if (error instanceof BackblazeConfigError) return privateJson({ error: 'ระบบจัดเก็บรูปภาพยังไม่พร้อมใช้งาน' }, 503)
  console.error('Member report API failed', error)
  return privateJson({ error: fallback }, 500)
}

export async function GET() {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  try { return privateJson({ items: await listMemberReports(auth.user.id) }) }
  catch (error) { return reportError(error, 'โหลดประวัติการแจ้งปัญหาไม่สำเร็จ') }
}

export async function POST(request: Request) {
  const auth = await authorizeMember(); if (!auth.ok) return auth.response
  try { return privateJson({ report: await createMemberReport(auth.user, await request.formData()) }, 201) }
  catch (error) { return reportError(error, 'ส่งเรื่องไม่สำเร็จ กรุณาลองใหม่') }
}
