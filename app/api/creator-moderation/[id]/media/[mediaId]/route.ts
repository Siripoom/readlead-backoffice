export const dynamic = 'force-dynamic'
import { authorizeApi } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import { downloadCreatorMedia } from '@/lib/storage/backblaze'
type Context = { params: Promise<{ id: string; mediaId: string }> }

export async function GET(_request: Request, context: Context) {
  const auth = await authorizeApi('cms'); if (!auth.ok) return auth.response
  const { id, mediaId } = await context.params
  const request = await getPrisma().creatorModerationRequest.findUnique({ where: { id }, select: { workId: true, work: { select: { coverObjectKey: true, coverContentType: true } } } })
  if (!request) return Response.json({ error: 'ไม่พบคำขอ' }, { status: 404 })
  let key: string | null = null
  let contentType: string | null = null
  if (mediaId === 'cover') { key = request.work.coverObjectKey; contentType = request.work.coverContentType }
  else {
    const asset = await getPrisma().workAsset.findFirst({ where: { id: mediaId, workId: request.workId }, select: { objectKey: true, contentType: true } })
    key = asset?.objectKey ?? null; contentType = asset?.contentType ?? null
  }
  if (!key) return Response.json({ error: 'ไม่พบไฟล์' }, { status: 404 })
  try {
    const media = await downloadCreatorMedia(key)
    await getPrisma().auditLog.create({ data: { adminId: auth.admin.id, action: 'creator_moderation.media_open', entity: 'CreatorModerationRequest', entityId: id, detail: { mediaKind: mediaId === 'cover' ? 'cover' : 'episode_asset' } } })
    return new Response(Uint8Array.from(media.body).buffer, { headers: { 'Content-Type': contentType || media.contentType, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    console.error('Creator moderation media failed', error instanceof Error ? error.name : 'UnknownError')
    return Response.json({ error: 'เปิดไฟล์ไม่สำเร็จ' }, { status: 502 })
  }
}
