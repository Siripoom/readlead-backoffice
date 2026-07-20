export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { authorizeApi } from '@/lib/auth'
import { getWriterApplicationDocument, recordWriterApplicationAudit } from '@/lib/db/writer-applications'
import { downloadWriterDocument, WriterDocumentStorageConfigError } from '@/lib/storage/writer-documents'
import { WriterApplicationEncryptionConfigError } from '@/lib/writer-application-crypto'

type Context = { params: Promise<{ id: string; kind: string }> }

export async function GET(_request: NextRequest, context: Context) {
  const auth = await authorizeApi('users')
  if (!auth.ok) return auth.response
  const { id, kind: rawKind } = await context.params
  if (rawKind !== 'identity' && rawKind !== 'bank') {
    return NextResponse.json({ error: 'ประเภทเอกสารไม่ถูกต้อง' }, { status: 400 })
  }
  const kind = rawKind as 'identity' | 'bank'

  try {
    const document = await getWriterApplicationDocument(id, kind)
    if (!document) return NextResponse.json({ error: 'ไม่พบใบสมัคร' }, { status: 404 })
    if (document.contentType !== 'image/jpeg' && document.contentType !== 'image/png') {
      throw new Error('Unsupported writer document content type')
    }
    const bytes = await downloadWriterDocument({ key: document.key, kind })
    await recordWriterApplicationAudit({
      adminId: auth.admin.id,
      applicationId: id,
      action: 'writer_application.document_viewed',
      detail: { kind },
    })
    const extension = document.contentType === 'image/png' ? 'png' : 'jpg'
    return new Response(Buffer.from(bytes), {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Disposition': `inline; filename="${kind}.${extension}"`,
        'Content-Type': document.contentType,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof WriterApplicationEncryptionConfigError || error instanceof WriterDocumentStorageConfigError) {
      return NextResponse.json({ error: 'ระบบเอกสารยังไม่พร้อมใช้งาน' }, { status: 503 })
    }
    console.error('Writer application document failed', error)
    return NextResponse.json({ error: 'โหลดเอกสารไม่สำเร็จ' }, { status: 500 })
  }
}
