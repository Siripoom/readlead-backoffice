import { randomUUID } from 'node:crypto'
import { authorizeApi } from '@/lib/auth'
import { BackblazeConfigError, uploadCmsImage } from '@/lib/storage/backblaze'

const allowed = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/gif', 'gif']])
const maxFileSize = 5 * 1024 * 1024

export async function POST(request: Request) {
  const auth = await authorizeApi('cms')
  if (!auth.ok) return auth.response
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File) || !allowed.has(file.type)) return Response.json({ error: 'รองรับเฉพาะ JPEG, PNG, WebP และ GIF' }, { status: 400 })
  if (file.size > maxFileSize) return Response.json({ error: 'ไฟล์ต้องไม่เกิน 5 MB' }, { status: 400 })
  if (file.size === 0) return Response.json({ error: 'ไฟล์รูปภาพว่างเปล่า' }, { status: 400 })

  try {
    const result = await uploadCmsImage({ body: new Uint8Array(await file.arrayBuffer()), contentType: file.type, extension: allowed.get(file.type)!, size: file.size, id: randomUUID() })
    return Response.json({ url: result.url })
  } catch (error) {
    if (error instanceof BackblazeConfigError) {
      console.error('Backblaze upload configuration is incomplete:', error.missing.join(', '))
      return Response.json({ error: 'ยังไม่ได้ตั้งค่าระบบจัดเก็บรูปภาพ Backblaze ให้ครบ' }, { status: 503 })
    }
    console.error('Backblaze image upload failed', error instanceof Error ? error.name : 'UnknownError')
    return Response.json({ error: 'อัปโหลดรูปไปยัง Backblaze ไม่สำเร็จ กรุณาลองใหม่' }, { status: 502 })
  }
}
