import { getPrisma } from '@/lib/prisma'

export function getAds() {
  const prisma = getPrisma()
  return prisma.ad.findMany({ orderBy: { validFrom: 'desc' } })
}

export function getAdPlacements() {
  const prisma = getPrisma()
  return prisma.adPlacement.findMany({ orderBy: { name: 'asc' } })
}

export function updateAdStatus(id: string, active: boolean) {
  const prisma = getPrisma()
  return prisma.ad.update({ where: { id }, data: { active } })
}

export function updateAdPlacementStatus(id: string, active: boolean) {
  const prisma = getPrisma()
  return prisma.adPlacement.update({ where: { id }, data: { active } })
}
