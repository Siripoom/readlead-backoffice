export const dynamic = 'force-dynamic'

import { getPrisma } from '@/lib/prisma'
import {
  BackblazeConfigError,
  CreatorMediaEncryptionConfigError,
  downloadCreatorMedia,
} from '@/lib/storage/backblaze'

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const work = await getPrisma().creatorWork.findFirst({
    where: {
      id: (await context.params).id,
      OR: [
        { status: 'approved' },
        { status: 'published', coverIsPublic: true, episodes: { some: { status: 'published' } } },
      ],
    },
    select: { coverObjectKey: true, coverContentType: true },
  })
  if (!work?.coverObjectKey) return Response.json({ error: 'ไม่พบภาพปก' }, { status: 404 })

  try {
    const media = await downloadCreatorMedia(work.coverObjectKey)
    return new Response(Uint8Array.from(media.body).buffer, {
      headers: {
        'Content-Type': work.coverContentType || media.contentType,
        'Content-Length': String(media.contentLength),
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof BackblazeConfigError || error instanceof CreatorMediaEncryptionConfigError) {
      return Response.json({ error: 'ระบบจัดเก็บไฟล์ยังไม่พร้อมใช้งาน' }, { status: 503 })
    }
    console.error('Public creator cover read failed', error instanceof Error ? error.name : 'UnknownError')
    return Response.json({ error: 'เปิดภาพปกไม่สำเร็จ' }, { status: 502 })
  }
}
