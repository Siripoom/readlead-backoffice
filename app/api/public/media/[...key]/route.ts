export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { downloadCmsImage } from '@/lib/storage/backblaze'

type Context = { params: Promise<{ key: string[] }> }

export async function GET(_request: Request, context: Context) {
  const key = (await context.params).key.join('/')
  try {
    const object = await downloadCmsImage(key)
    if (!object.contentType?.startsWith('image/')) throw new Error('Invalid CMS content type')
    return new Response(Buffer.from(object.bytes), { headers: {
      'Content-Type': object.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    console.error('CMS image download failed', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'ไม่พบรูป' }, { status: 404 })
  }
}
