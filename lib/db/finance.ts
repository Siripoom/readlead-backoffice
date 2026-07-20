import { getPrisma } from '@/lib/prisma'
import { decryptWriterApplicationPayload } from '@/lib/writer-application-crypto'
import type { WithdrawalStatus } from '@/lib/generated/prisma/enums'

const withdrawalSafeSelect = {
  id: true, userId: true, creator: true, bank: true, bankAccount: true, amount: true, amountSatang: true, taxSatang: true, feeSatang: true, netSatang: true,
  payoutMode: true, payoutPeriod: true, requestedAt: true, status: true, slipUrl: true, reviewerName: true, reviewedAt: true,
} as const

export function getMonthlyIncome() { return getPrisma().monthlyIncome.findMany({ orderBy: { recordedAt: 'asc' } }) }

export function getWithdrawalRequests() {
  return getPrisma().withdrawalRequest.findMany({ select: withdrawalSafeSelect, orderBy: { requestedAt: 'desc' } })
}

export async function getWithdrawalDetail(id: string, adminId: string) {
  const prisma = getPrisma()
  const withdrawal = await prisma.withdrawalRequest.findUnique({ where: { id }, select: { ...withdrawalSafeSelect, encryptedDestination: true, history: { orderBy: { createdAt: 'desc' }, select: { status: true, note: true, createdAt: true } } } })
  if (!withdrawal) return null
  let destination: { bankName?: string; accountNumber?: string; accountName?: string } | null = null
  if (withdrawal.encryptedDestination) destination = decryptWriterApplicationPayload(withdrawal.encryptedDestination)
  await prisma.auditLog.create({ data: { adminId, action: 'finance.withdrawal_open', entity: 'WithdrawalRequest', entityId: id } })
  const { encryptedDestination: _secret, ...safe } = withdrawal
  void _secret
  return { ...safe, destination }
}

export async function updateWithdrawalStatus(input: { id: string; status: WithdrawalStatus; adminId: string; reviewerName?: string; note?: string }) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const current = await tx.withdrawalRequest.findUnique({ where: { id: input.id }, select: { ...withdrawalSafeSelect } })
    if (!current) throw new Error('NOT_FOUND')
    if (current.status !== 'pending') {
      if (current.status === input.status) return current
      throw new Error('CONFLICT')
    }
    const claimed = await tx.withdrawalRequest.updateMany({ where: { id: input.id, status: 'pending' }, data: { status: input.status, reviewerName: input.reviewerName, reviewedAt: new Date() } })
    if (!claimed.count) throw new Error('CONFLICT')
    await tx.withdrawalHistory.create({ data: { withdrawalId: input.id, status: input.status, note: input.note } })
    if (current.userId && current.amountSatang) await tx.creatorRevenueLedger.create({ data: {
      userId: current.userId,
      kind: input.status === 'rejected' ? 'withdrawal_release' : 'withdrawal_paid',
      amountSatang: input.status === 'rejected' ? current.amountSatang : 0,
      referenceId: current.id,
      idempotencyKey: `${input.status === 'rejected' ? 'withdrawal-release' : 'withdrawal-paid'}:${current.id}`,
    } })
    await tx.auditLog.create({ data: { adminId: input.adminId, action: `finance.withdrawal_${input.status}`, entity: 'WithdrawalRequest', entityId: current.id, detail: { amountSatang: current.amountSatang, taxSatang: current.taxSatang, netSatang: current.netSatang } } })
    return tx.withdrawalRequest.findUniqueOrThrow({ where: { id: current.id }, select: withdrawalSafeSelect })
  }, { isolationLevel: 'Serializable' })
}
