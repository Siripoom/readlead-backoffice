import { randomUUID } from 'node:crypto'
import { authorizeApi } from '@/lib/auth'
import { validateCmsImage } from '@/lib/cms-image-validation'
import { BackblazeConfigError, uploadCmsImage } from '@/lib/storage/backblaze'

export async function POST(request: Request) {
  const auth = await authorizeApi('cms')
  if (!auth.ok) return auth.response
  const form = await request.formData()
  const validation = await validateCmsImage(form.get('file'))
  if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 })

  try {
    const result = await uploadCmsImage({ ...validation.image, id: randomUUID() })
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
