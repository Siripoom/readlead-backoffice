export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getContent } from '@/lib/db/content'

export async function GET() {
  const content = await getContent()
  return NextResponse.json(content)
}
