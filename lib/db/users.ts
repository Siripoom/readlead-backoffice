import { getPrisma } from '@/lib/prisma'
import type { UserStatus, UserType } from '@/lib/generated/prisma/enums'

export function getUsers() {
  const prisma = getPrisma()
  return prisma.user.findMany({
    orderBy: { joinedAt: 'desc' },
    include: { creatorProfile: true, adminProfile: true },
  })
}

export function getUserById(id: string) {
  const prisma = getPrisma()
  return prisma.user.findUnique({
    where: { id },
    include: { creatorProfile: true, adminProfile: true },
  })
}

export function getUsersByType(userType: UserType) {
  const prisma = getPrisma()
  return prisma.user.findMany({
    where: { userType },
    orderBy: { joinedAt: 'desc' },
    include: { creatorProfile: true, adminProfile: true },
  })
}

export function getUserPunishments(userId: string) {
  const prisma = getPrisma()
  return prisma.punishmentRecord.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  })
}

export function updateUserStatus(id: string, status: UserStatus) {
  const prisma = getPrisma()
  return prisma.user.update({ where: { id }, data: { status } })
}
