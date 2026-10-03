const MAX_CMS_IMAGE_SIZE = 5 * 1024 * 1024

type CmsImageFormat = {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  extension: 'jpg' | 'png' | 'webp' | 'gif'
}

export type ValidatedCmsImage = CmsImageFormat & {
  body: Uint8Array
  size: number
}

const jpeg: CmsImageFormat = { contentType: 'image/jpeg', extension: 'jpg' }
const png: CmsImageFormat = { contentType: 'image/png', extension: 'png' }
const webp: CmsImageFormat = { contentType: 'image/webp', extension: 'webp' }
const gif: CmsImageFormat = { contentType: 'image/gif', extension: 'gif' }

function matches(body: Uint8Array, signature: number[], offset = 0) {
  return body.length >= offset + signature.length
    && signature.every((byte, index) => body[offset + index] === byte)
}

export function detectCmsImageFormat(body: Uint8Array): CmsImageFormat | null {
  if (matches(body, [0xff, 0xd8, 0xff])) return jpeg
  if (matches(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return png
  if (matches(body, [0x52, 0x49, 0x46, 0x46]) && matches(body, [0x57, 0x45, 0x42, 0x50], 8)) return webp
  if (matches(body, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || matches(body, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return gif
  return null
}

export async function validateCmsImage(value: FormDataEntryValue | null): Promise<
  | { ok: true; image: ValidatedCmsImage }
  | { ok: false; error: string }
> {
  if (!(value instanceof File)) return { ok: false, error: 'รองรับเฉพาะ JPEG, PNG, WebP และ GIF' }
  if (value.size > MAX_CMS_IMAGE_SIZE) return { ok: false, error: 'ไฟล์ต้องไม่เกิน 5 MB' }
  if (value.size === 0) return { ok: false, error: 'ไฟล์รูปภาพว่างเปล่า' }

  const body = new Uint8Array(await value.arrayBuffer())
  const format = detectCmsImageFormat(body)
  if (!format || value.type.toLowerCase() !== format.contentType) {
    return { ok: false, error: 'เนื้อหาไฟล์ไม่ตรงกับรูปแบบ JPEG, PNG, WebP หรือ GIF ที่รองรับ' }
  }
  return { ok: true, image: { ...format, body, size: body.byteLength } }
}
