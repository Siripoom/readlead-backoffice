import { prisma } from '@/lib/prisma'
import type { WithdrawalStatus } from '@/lib/generated/prisma'

export function getMonthlyIncome() {
  return prisma.monthlyIncome.findMany({ orderBy: { recordedAt: 'asc' } })
}

export function getWithdrawalRequests() {
  return prisma.withdrawalRequest.findMany({ orderBy: { requestedAt: 'desc' } })
}

export function updateWithdrawalStatus(id: string, status: WithdrawalStatus) {
  return prisma.withdrawalRequest.update({ where: { id }, data: { status } })
}
