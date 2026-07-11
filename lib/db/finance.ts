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

export function updateWithdrawalStatus(id: string, status: WithdrawalStatus, reviewerName?: string, note?: string) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawalRequest.update({ where: { id }, data: { status, reviewerName, reviewedAt: new Date() } })
    await tx.withdrawalHistory.create({ data: { withdrawalId: id, status, note } })
    return withdrawal
  })
}
