export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getPromotions, getPricing, getVipLevels, getExpTitles } from '@/lib/db/monetization'

export async function GET() {
  const [promotions, pricing, vipLevels, expTitles] = await Promise.all([
    getPromotions(),
    getPricing(),
    getVipLevels(),
    getExpTitles(),
  ])
  return NextResponse.json({ promotions, pricing, vipLevels, expTitles })
}
