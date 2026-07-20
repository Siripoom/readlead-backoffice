export const dynamic = 'force-dynamic'
import { getMemberSessionUser } from '@/lib/member-auth'
import { getPrisma } from '@/lib/prisma'
import { downloadCreatorMedia } from '@/lib/storage/backblaze'
type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const user = await getMemberSessionUser()
  const asset = await getPrisma().workAsset.findUnique({ where: { id: (await context.params).id }, select: { objectKey: true, contentType: true, episode: { select: { id: true, priceCoins: true, status: true, work: { select: { creatorId: true, status: true } } } } } })
  if (!asset?.episode || asset.episode.status !== 'published' || asset.episode.work.status !== 'published') return Response.json({ error: 'ไม่พบไฟล์' }, { status: 404 })
  const owner = user?.id === asset.episode.work.creatorId
  const purchase = user && asset.episode.priceCoins > 0 ? await getPrisma().episodePurchase.findUnique({ where: { userId_episodeId: { userId: user.id, episodeId: asset.episode.id } }, select: { id: true } }) : null
  if (asset.episode.priceCoins > 0 && !owner && !purchase) return Response.json({ error: 'ไม่มีสิทธิ์เปิดไฟล์นี้' }, { status: user ? 403 : 401, headers: { 'Cache-Control': 'private, no-store' } })
  try {
    const range = request.headers.get('range')
    const media = await downloadCreatorMedia(asset.objectKey, range)
    const headers = new Headers({ 'Content-Type': asset.contentType, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': media.acceptRanges || 'bytes' })
    if (media.contentLength !== undefined) headers.set('Content-Length', String(media.contentLength))
    if (media.contentRange) headers.set('Content-Range', media.contentRange)
    return new Response(Uint8Array.from(media.body).buffer, { status: range && media.contentRange ? 206 : 200, headers })
  } catch (error) {
    console.error('Episode media read failed', error instanceof Error ? error.name : 'UnknownError')
    return Response.json({ error: 'เปิดไฟล์ไม่สำเร็จ' }, { status: 502 })
  }
}
