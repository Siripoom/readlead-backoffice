import { NextRequest, NextResponse } from 'next/server'
import { getContentById, updateContentStatus } from '@/lib/db/content'
import type { ContentStatus } from '@/lib/generated/prisma/enums'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const content = await getContentById(id)
  if (!content) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(content)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await request.json() as { status: ContentStatus }
  const content = await updateContentStatus(id, body.status)
  return NextResponse.json(content)
}
