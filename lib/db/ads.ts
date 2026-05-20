import { prisma } from '@/lib/prisma'

export function getAds() {
  return prisma.ad.findMany({ orderBy: { validFrom: 'desc' } })
}

export function getAdPlacements() {
  return prisma.adPlacement.findMany({ orderBy: { name: 'asc' } })
}

export function updateAdStatus(id: string, active: boolean) {
  return prisma.ad.update({ where: { id }, data: { active } })
}

export function updateAdPlacementStatus(id: string, active: boolean) {
  return prisma.adPlacement.update({ where: { id }, data: { active } })
}
