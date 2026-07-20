export const dynamic = 'force-dynamic'

import { authorizeMember, privateJson } from '@/lib/creator-api'
import { getPrisma } from '@/lib/prisma'
import { BackblazeConfigError, CreatorMediaEncryptionConfigError, downloadCreatorMedia } from '@/lib/storage/backblaze'

type Context = { params: Promise<{ id: string; episodeId: string; assetId: string }> }

export async function GET(request: Request, context: Context) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  const { id: workId, episodeId, assetId } = await context.params
  const asset = await getPrisma().workAsset.findFirst({
    where: { id: assetId, workId, episodeId },
    select: { objectKey: true, contentType: true, episode: { select: { work: { select: { creatorId: true } } } } },
  })
  if (!asset?.episode) return privateJson({ error: 'ไม่พบไฟล์' }, 404)
  if (asset.episode.work.creatorId !== auth.user.id) return privateJson({ error: 'ไม่มีสิทธิ์เปิดไฟล์นี้' }, 403)
  try {
    const range = request.headers.get('range')
    const media = await downloadCreatorMedia(asset.objectKey, range)
    const headers = new Headers({
      'Content-Type': asset.contentType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': media.acceptRanges || 'bytes',
    })
    headers.set('Content-Length', String(media.contentLength))
    if (media.contentRange) headers.set('Content-Range', media.contentRange)
    return new Response(Uint8Array.from(media.body).buffer, { status: range && media.contentRange ? 206 : 200, headers })
  } catch (error) {
    if (error instanceof BackblazeConfigError || error instanceof CreatorMediaEncryptionConfigError) return privateJson({ error: 'ระบบจัดเก็บไฟล์ยังไม่พร้อมใช้งาน' }, 503)
    console.error('Creator asset read failed', error instanceof Error ? error.name : 'UnknownError')
    return privateJson({ error: 'เปิดไฟล์ไม่สำเร็จ' }, 502)
  }
}
