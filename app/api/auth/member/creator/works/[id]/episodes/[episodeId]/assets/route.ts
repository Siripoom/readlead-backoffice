import { createHmac, randomUUID } from 'node:crypto'
import { authorizeMember, privateJson } from '@/lib/creator-api'
import { getPrisma } from '@/lib/prisma'
import { BackblazeConfigError, CreatorMediaEncryptionConfigError, deleteCreatorMedia, uploadCreatorMedia } from '@/lib/storage/backblaze'

type Context = { params: Promise<{ id: string; episodeId: string }> }
const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a' }

function validMagic(type: string, bytes: Uint8Array) {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (type === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (type === 'audio/mpeg') return String.fromCharCode(...bytes.slice(0, 3)) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  if (type === 'audio/wav' || type === 'audio/x-wav') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WAVE'
  if (type === 'audio/mp4' || type === 'audio/x-m4a') return String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp'
  return false
}

export async function POST(request: Request, context: Context) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  const { id: workId, episodeId } = await context.params
  const episode = await getPrisma().creatorEpisode.findUnique({ where: { id: episodeId }, select: { workId: true, type: true, status: true, work: { select: { creatorId: true, status: true } } } })
  if (!episode || episode.workId !== workId) return privateJson({ error: 'ไม่พบตอน' }, 404)
  if (episode.work.creatorId !== auth.user.id) return privateJson({ error: 'ไม่มีสิทธิ์แก้ไขตอนนี้' }, 403)
  if (episode.work.status === 'archived' || episode.work.status === 'deletion_pending') return privateJson({ error: 'สถานะผลงานนี้ไม่รองรับการแก้ไขไฟล์' }, 409)
  const form = await request.formData()
  const file = form.get('file')
  const kind = form.get('kind') === 'audio' ? 'audio' : 'page'
  if ((episode.type === 'image' && kind !== 'page') || (episode.type === 'audio' && kind !== 'audio') || episode.type === 'text') return privateJson({ error: 'ประเภทไฟล์ไม่ตรงกับประเภทตอน' }, 400)
  if (!(file instanceof File) || !extensions[file.type]) return privateJson({ error: 'ชนิดไฟล์ไม่รองรับ' }, 400)
  if ((kind === 'page' && !file.type.startsWith('image/')) || (kind === 'audio' && !file.type.startsWith('audio/'))) return privateJson({ error: 'ชนิดไฟล์ไม่ตรงกับประเภทตอน' }, 400)
  const max = kind === 'audio' ? 100 * 1024 * 1024 : 10 * 1024 * 1024
  if (!file.size || file.size > max) return privateJson({ error: kind === 'audio' ? 'ไฟล์เสียงต้องไม่เกิน 100 MB' : 'ภาพแต่ละหน้าต้องไม่เกิน 10 MB' }, 413)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!validMagic(file.type, bytes)) return privateJson({ error: 'ชนิดไฟล์ไม่ตรงกับข้อมูลภายในไฟล์' }, 400)
  const secret = process.env.WRITER_APPLICATION_ENCRYPTION_KEY || process.env.B2_APP_KEY || 'creator-media'
  const workToken = createHmac('sha256', secret).update(workId).digest('hex').slice(0, 24)
  try {
    const uploaded = await uploadCreatorMedia({ body: bytes, contentType: file.type, extension: extensions[file.type], size: file.size, id: randomUUID(), workToken })
    const asset = await getPrisma().workAsset.create({ data: { workId, episodeId, kind, objectKey: uploaded.key, contentType: file.type, sizeBytes: file.size, sortOrder: Math.max(0, Number(form.get('sortOrder')) || 0), isPublic: false } })
    return privateJson({ asset: { id: asset.id, kind: asset.kind, contentType: asset.contentType, sizeBytes: asset.sizeBytes, sortOrder: asset.sortOrder, durationSeconds: asset.durationSeconds, isPublic: asset.isPublic, createdAt: asset.createdAt } }, 201)
  } catch (error) {
    if (error instanceof BackblazeConfigError || error instanceof CreatorMediaEncryptionConfigError) return privateJson({ error: 'ระบบจัดเก็บไฟล์ยังไม่พร้อมใช้งาน' }, 503)
    console.error('Creator media upload failed', error instanceof Error ? error.name : 'UnknownError')
    return privateJson({ error: 'อัปโหลดไฟล์ไม่สำเร็จ' }, 502)
  }
}

export async function PATCH(request: Request, context: Context) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  const { id: workId, episodeId } = await context.params
  const body = await request.json().catch(() => null) as { kind?: string; orderedAssetIds?: unknown } | null
  const kind = body?.kind === 'audio' ? 'audio' : body?.kind === 'page' ? 'page' : null
  const orderedAssetIds = Array.isArray(body?.orderedAssetIds) ? body.orderedAssetIds.map(String) : []
  if (!kind || !orderedAssetIds.length || orderedAssetIds.length > 500 || new Set(orderedAssetIds).size !== orderedAssetIds.length) return privateJson({ error: 'รายการไฟล์ไม่ถูกต้อง' }, 400)

  const prisma = getPrisma()
  const episode = await prisma.creatorEpisode.findUnique({ where: { id: episodeId }, select: { workId: true, type: true, status: true, work: { select: { creatorId: true, status: true } } } })
  if (!episode || episode.workId !== workId) return privateJson({ error: 'ไม่พบตอน' }, 404)
  if (episode.work.creatorId !== auth.user.id) return privateJson({ error: 'ไม่มีสิทธิ์แก้ไขตอนนี้' }, 403)
  if (episode.work.status === 'archived' || episode.work.status === 'deletion_pending') return privateJson({ error: 'สถานะผลงานนี้ไม่รองรับการแก้ไขไฟล์' }, 409)
  if ((episode.type === 'image' && kind !== 'page') || (episode.type === 'audio' && kind !== 'audio') || episode.type === 'text') return privateJson({ error: 'ประเภทไฟล์ไม่ตรงกับประเภทตอน' }, 400)
  if (kind === 'audio' && orderedAssetIds.length !== 1) return privateJson({ error: 'หนึ่งตอนรองรับไฟล์เสียงหนึ่งไฟล์' }, 400)

  const existing = await prisma.workAsset.findMany({ where: { workId, episodeId, kind }, select: { id: true, objectKey: true } })
  const existingIds = new Set(existing.map((asset) => asset.id))
  if (orderedAssetIds.some((id) => !existingIds.has(id))) return privateJson({ error: 'มีไฟล์ที่ไม่อยู่ในตอนนี้' }, 400)
  const removed = existing.filter((asset) => !orderedAssetIds.includes(asset.id))
  const isPublic = episode.status === 'published' && episode.work.status === 'published'
  const assets = await prisma.$transaction(async (tx) => {
    if (removed.length) await tx.workAsset.deleteMany({ where: { id: { in: removed.map((asset) => asset.id) }, workId, episodeId, kind } })
    for (const [sortOrder, id] of orderedAssetIds.entries()) await tx.workAsset.update({ where: { id }, data: { sortOrder, isPublic } })
    return tx.workAsset.findMany({ where: { id: { in: orderedAssetIds } }, orderBy: { sortOrder: 'asc' }, select: { id: true, kind: true, contentType: true, sizeBytes: true, sortOrder: true, durationSeconds: true, isPublic: true, createdAt: true } })
  })
  if (removed.length) {
    const results = await Promise.allSettled(removed.map((asset) => deleteCreatorMedia(asset.objectKey)))
    results.forEach((result, index) => { if (result.status === 'rejected') console.error('Creator media cleanup failed', { assetId: removed[index].id, error: result.reason instanceof Error ? result.reason.name : 'UnknownError' }) })
  }
  return privateJson({ assets })
}
