import { getPrisma } from '@/lib/prisma'

export function getPromotions() {
  const prisma = getPrisma()
  return prisma.promotion.findMany({ orderBy: { validFrom: 'asc' } })
}

export function getPricing() {
  const prisma = getPrisma()
  return prisma.pricing.findMany({ orderBy: { category: 'asc' } })
}

export function getVipLevels() {
  const prisma = getPrisma()
  return prisma.vipLevel.findMany({ orderBy: { level: 'asc' } })
}

export function getExpTitles() {
  const prisma = getPrisma()
  return prisma.expTitle.findMany({ orderBy: { minExp: 'asc' } })
}

export function updatePromotion(id: string, data: { active?: boolean; discount?: number }) {
  const prisma = getPrisma()
  return prisma.promotion.update({ where: { id }, data })
}

export function updatePricing(id: string, pricePerEpisode: number) {
  const prisma = getPrisma()
  return prisma.pricing.update({ where: { id }, data: { pricePerEpisode } })
}
