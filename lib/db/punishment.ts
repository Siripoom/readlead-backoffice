import { getPrisma } from '@/lib/prisma'

export function getPunishmentLevels() {
  const prisma = getPrisma()
  return prisma.punishmentLevel.findMany({ orderBy: { level: 'asc' } })
}

export function getPunishmentRecords() {
  const prisma = getPrisma()
  return prisma.punishmentRecord.findMany({
    orderBy: { date: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
}
