import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

let state = 'pending'
let reference: string | null = null
const ledger: string[] = []
const tx = {
  withdrawalRequest: {
    findUnique: async () => ({ id: 'withdrawal-a', userId: 'creator-a', amountSatang: 10000, status: state, transferReference: reference }),
    updateMany: async ({ where, data }: { where: { status: string }; data: { status: string; transferReference?: string } }) => {
      if (state !== where.status) return { count: 0 }
      state = data.status
      reference = data.transferReference ?? null
      return { count: 1 }
    },
    findUniqueOrThrow: async () => ({ id: 'withdrawal-a', status: state, transferReference: reference }),
  },
  withdrawalHistory: { create: async () => ({}) },
  creatorRevenueLedger: { create: async ({ data }: { data: { kind: string } }) => { ledger.push(data.kind) } },
  auditLog: { create: async () => ({}) },
}
mock.module('@/lib/prisma', { exports: { getPrisma: () => ({ $transaction: async <T,>(callback: (client: typeof tx) => Promise<T>) => callback(tx) }) } })
mock.module('@/lib/writer-application-crypto', { exports: { decryptWithdrawalDestination: () => null } })
const { updateWithdrawalStatus } = await import('../lib/db/finance')

test('approval authorizes transfer; paid needs reference and writes ledger once', async () => {
  const common = { id: 'withdrawal-a', adminId: 'admin-a' }
  await updateWithdrawalStatus({ ...common, status: 'approved' })
  assert.deepEqual(ledger, [])
  await assert.rejects(updateWithdrawalStatus({ ...common, status: 'paid' }), /TRANSFER_REFERENCE_REQUIRED/)
  assert.deepEqual(ledger, [])
  await updateWithdrawalStatus({ ...common, status: 'paid', transferReference: 'BANK-123' })
  assert.deepEqual(ledger, ['withdrawal_paid'])
  await updateWithdrawalStatus({ ...common, status: 'paid', transferReference: 'BANK-123' })
  assert.deepEqual(ledger, ['withdrawal_paid'])
  await assert.rejects(updateWithdrawalStatus({ ...common, status: 'paid', transferReference: 'OTHER' }), /CONFLICT/)
})
