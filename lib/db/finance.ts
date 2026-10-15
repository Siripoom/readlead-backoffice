import { getPrisma } from '@/lib/prisma'
import { decryptWithdrawalDestination } from '@/lib/writer-application-crypto'
import type { WithdrawalStatus } from '@/lib/generated/prisma/enums'

const withdrawalSafeSelect = {
  id: true, userId: true, creator: true, bank: true, bankAccount: true, amount: true, amountSatang: true, taxSatang: true, feeSatang: true, netSatang: true,
  payoutMode: true, payoutPeriod: true, requestedAt: true, status: true, slipUrl: true, reviewerName: true, reviewedAt: true, transferReference: true, paidAt: true,
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
  if (withdrawal.encryptedDestination) destination = decryptWithdrawalDestination(withdrawal.encryptedDestination, withdrawal.id)
  await prisma.auditLog.create({ data: { adminId, action: 'finance.withdrawal_open', entity: 'WithdrawalRequest', entityId: id } })
  const { encryptedDestination: _secret, ...safe } = withdrawal
  void _secret
  return { ...safe, destination }
}

export async function updateWithdrawalStatus(input: { id: string; status: WithdrawalStatus; adminId: string; reviewerName?: string; note?: string; transferReference?: string }) {
  const prisma = getPrisma()
  try {
    return await prisma.$transaction(async (tx) => {
    const current = await tx.withdrawalRequest.findUnique({ where: { id: input.id }, select: { ...withdrawalSafeSelect } })
    if (!current) throw new Error('NOT_FOUND')
    if (current.status === input.status && input.status !== 'paid') return current
    if (input.status === 'paid' && current.status === 'paid' && current.transferReference === input.transferReference) return current
    const expected = input.status === 'paid' ? 'approved' : 'pending'
    if (current.status !== expected) throw new Error('CONFLICT')
    if (input.status === 'paid' && !input.transferReference) throw new Error('TRANSFER_REFERENCE_REQUIRED')
    const claimed = await tx.withdrawalRequest.updateMany({
      where: { id: input.id, status: expected },
      data: input.status === 'paid'
        ? { status: 'paid', transferReference: input.transferReference, paidAt: new Date() }
        : { status: input.status, reviewerName: input.reviewerName, reviewedAt: new Date() },
    })
    if (!claimed.count) throw new Error('CONFLICT')
    await tx.withdrawalHistory.create({ data: { withdrawalId: input.id, status: input.status, note: input.status === 'paid' ? input.transferReference : input.note } })
    if (current.userId && current.amountSatang && input.status !== 'approved') await tx.creatorRevenueLedger.create({ data: {
      userId: current.userId,
      kind: input.status === 'rejected' ? 'withdrawal_release' : 'withdrawal_paid',
      amountSatang: input.status === 'rejected' ? current.amountSatang : 0,
      referenceId: current.id,
      idempotencyKey: `${input.status === 'rejected' ? 'withdrawal-release' : 'withdrawal-paid'}:${current.id}`,
      metadata: input.status === 'paid' ? { transferReference: input.transferReference } : undefined,
    } })
    await tx.auditLog.create({ data: { adminId: input.adminId, action: `finance.withdrawal_${input.status}`, entity: 'WithdrawalRequest', entityId: current.id, detail: { amountSatang: current.amountSatang, taxSatang: current.taxSatang, netSatang: current.netSatang, transferReference: input.transferReference } } })
    return tx.withdrawalRequest.findUniqueOrThrow({ where: { id: current.id }, select: withdrawalSafeSelect })
    }, { isolationLevel: 'Serializable' })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') throw new Error('CONFLICT')
    throw error
  }
}
