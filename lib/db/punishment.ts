import { prisma } from '@/lib/prisma'

export function getPunishmentLevels() {
  return prisma.punishmentLevel.findMany({ orderBy: { level: 'asc' } })
}

export function getPunishmentRecords() {
  return prisma.punishmentRecord.findMany({
    orderBy: { date: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
}

export function createPunishmentRecord(data: {
  userId: string
  levelName: string
  note?: string
}) {
  return prisma.punishmentRecord.create({ data })
}

export function updatePunishmentLevel(
  id: string,
  data: { name?: string; threshold?: number; duration?: number }
) {
  return prisma.punishmentLevel.update({ where: { id }, data })
}
