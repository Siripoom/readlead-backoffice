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

export function updateUserName(id: string, name: string) {
  const prisma = getPrisma()
  return prisma.user.update({ where: { id }, data: { name } })
}

export function createUser(data: {
  name: string
  email: string
  userType?: UserType
  status?: UserStatus
  creatorProfile?: { works?: number; followers?: number }
  adminProfile?: { role: string }
}) {
  const prisma = getPrisma()
  const { creatorProfile, adminProfile, ...userData } = data
  return prisma.user.create({
    data: {
      ...userData,
      creatorProfile: creatorProfile ? { create: creatorProfile } : undefined,
      adminProfile: adminProfile ? { create: adminProfile } : undefined,
    },
    include: { creatorProfile: true, adminProfile: true },
  })
}
