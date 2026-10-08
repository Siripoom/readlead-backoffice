export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { authorizeMember } from '@/lib/creator-api'
import { getPrisma } from '@/lib/prisma'
import { downloadReportAttachment } from '@/lib/storage/backblaze'

type Context = { params: Promise<{ id: string; attachmentId: string }> }

export async function GET(_request: Request, context: Context) {
  const auth = await authorizeMember()
  if (!auth.ok) return auth.response
  const { id, attachmentId } = await context.params
  const attachment = await getPrisma().reportAttachment.findFirst({
    where: { id: attachmentId, reportId: id, report: { senderId: auth.user.id, isSupport: true } },
    select: { objectKey: true, contentType: true },
  })
  if (!attachment) return NextResponse.json({ error: 'ไม่พบไฟล์แนบ' }, { status: 404 })
  try {
    if (attachment.contentType !== 'image/jpeg' && attachment.contentType !== 'image/png') throw new Error('Invalid attachment type')
    const bytes = await downloadReportAttachment(attachment.objectKey)
    return new Response(Buffer.from(bytes), { headers: {
      'Content-Type': attachment.contentType,
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    console.error('Member report attachment failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'โหลดไฟล์แนบไม่สำเร็จ' }, { status: 502 })
  }
}
