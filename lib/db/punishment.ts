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

export function createPunishmentRecord(data: {
  userId: string
  levelName: string
  note?: string
}) {
  const prisma = getPrisma()
  return prisma.punishmentRecord.create({ data })
}

export function updatePunishmentLevel(
  id: string,
  data: { name?: string; threshold?: number; duration?: number }
) {
  const prisma = getPrisma()
  return prisma.punishmentLevel.update({ where: { id }, data })
}

export function createPunishmentLevel(data: {
  level: number
  name: string
  threshold: number
  duration: number
}) {
  const prisma = getPrisma()
  return prisma.punishmentLevel.create({ data })
}
