import { createHmac, randomUUID } from 'node:crypto'
import { authorizeMember, privateJson } from '@/lib/creator-api'
import { getPrisma } from '@/lib/prisma'
import { BackblazeConfigError, CreatorMediaEncryptionConfigError, uploadCreatorMedia } from '@/lib/storage/backblaze'

type Context = { params: Promise<{ id: string }> }
const formats = new Map([['image/jpeg', { extension: 'jpg', magic: [0xff, 0xd8, 0xff] }], ['image/png', { extension: 'png', magic: [0x89, 0x50, 0x4e, 0x47] }], ['image/webp', { extension: 'webp', magic: [0x52, 0x49, 0x46, 0x46] }]])

export async function POST(request: Request, context: Context) {
  const auth = await authorizeMember({ creator: true }); if (!auth.ok) return auth.response
  const workId = (await context.params).id
  const work = await getPrisma().creatorWork.findUnique({ where: { id: workId }, select: { creatorId: true, status: true } })
  if (!work) return privateJson({ error: 'ไม่พบผลงาน' }, 404)
  if (work.creatorId !== auth.user.id) return privateJson({ error: 'ไม่มีสิทธิ์แก้ไขผลงานนี้' }, 403)
  if (work.status !== 'draft' && work.status !== 'rejected') return privateJson({ error: 'แก้ไขปกได้เฉพาะผลงานฉบับร่างหรือผลงานที่ไม่ผ่านการตรวจ' }, 409)

  const file = (await request.formData()).get('file')
  if (!(file instanceof File)) return privateJson({ error: 'กรุณาเลือกไฟล์ปก' }, 400)
  const format = formats.get(file.type)
  if (!format) return privateJson({ error: 'รองรับเฉพาะ JPEG, PNG และ WebP' }, 400)
  if (!file.size || file.size > 5 * 1024 * 1024) return privateJson({ error: 'ไฟล์ปกต้องมีขนาดไม่เกิน 5 MB' }, 413)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!format.magic.every((value, index) => bytes[index] === value)) return privateJson({ error: 'ชนิดไฟล์ไม่ตรงกับข้อมูลภายในไฟล์' }, 400)
  if (file.type === 'image/webp' && String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP') return privateJson({ error: 'ไฟล์ WebP ไม่ถูกต้อง' }, 400)

  try {
    const secret = process.env.WRITER_APPLICATION_ENCRYPTION_KEY || process.env.B2_APP_KEY || 'creator-media'
    const workToken = createHmac('sha256', secret).update(workId).digest('hex').slice(0, 24)
    const uploaded = await uploadCreatorMedia({ body: bytes, contentType: file.type, extension: format.extension, size: file.size, id: randomUUID(), workToken })
    await getPrisma().creatorWork.update({ where: { id: workId }, data: { coverObjectKey: uploaded.key, coverContentType: file.type, coverIsPublic: false } })
    return privateJson({ uploaded: true })
  } catch (error) {
    if (error instanceof BackblazeConfigError || error instanceof CreatorMediaEncryptionConfigError) return privateJson({ error: 'ระบบจัดเก็บไฟล์ยังไม่พร้อมใช้งาน' }, 503)
    console.error('Creator cover upload failed', error instanceof Error ? error.name : 'UnknownError')
    return privateJson({ error: 'อัปโหลดปกไม่สำเร็จ กรุณาลองใหม่' }, 502)
  }
}
