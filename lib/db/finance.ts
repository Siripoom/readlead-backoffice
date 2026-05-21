import { getPrisma } from '@/lib/prisma'
import type { WithdrawalStatus } from '@/lib/generated/prisma/enums'

export function getMonthlyIncome() {
  const prisma = getPrisma()
  return prisma.monthlyIncome.findMany({ orderBy: { recordedAt: 'asc' } })
}

export function getWithdrawalRequests() {
  const prisma = getPrisma()
  return prisma.withdrawalRequest.findMany({ orderBy: { requestedAt: 'desc' } })
}

export function updateWithdrawalStatus(id: string, status: WithdrawalStatus) {
  const prisma = getPrisma()
  return prisma.withdrawalRequest.update({ where: { id }, data: { status } })
}
