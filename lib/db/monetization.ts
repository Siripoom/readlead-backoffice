import { prisma } from '@/lib/prisma'

export function getPromotions() {
  return prisma.promotion.findMany({ orderBy: { validFrom: 'asc' } })
}

export function getPricing() {
  return prisma.pricing.findMany({ orderBy: { category: 'asc' } })
}

export function getVipLevels() {
  return prisma.vipLevel.findMany({ orderBy: { level: 'asc' } })
}

export function getExpTitles() {
  return prisma.expTitle.findMany({ orderBy: { minExp: 'asc' } })
}

export function updatePromotion(id: string, data: { active?: boolean; discount?: number }) {
  return prisma.promotion.update({ where: { id }, data })
}

export function updatePricing(id: string, pricePerEpisode: number) {
  return prisma.pricing.update({ where: { id }, data: { pricePerEpisode } })
}
