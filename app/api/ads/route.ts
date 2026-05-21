export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAds, getAdPlacements } from '@/lib/db/ads'

export async function GET() {
  const [ads, placements] = await Promise.all([getAds(), getAdPlacements()])
  return NextResponse.json({ ads, placements })
}
