import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

let created: { id: string; userId: string; clientRequestKey: string; amountSatang: number; status: string; requestedAt: Date; taxSatang: number; netSatang: number } | null = null
let creates = 0
const tx = {
  withdrawalRequest: {
    findFirst: async ({ where }: { where: { userId: string; clientRequestKey: string } }) => created?.userId === where.userId && created.clientRequestKey === where.clientRequestKey ? created : null,
    create: async ({ data }: { data: { id: string; userId: string; clientRequestKey: string; amountSatang: number; taxSatang: number; netSatang: number } }) => {
      creates++
      created = { ...data, status: 'pending', requestedAt: new Date('2026-10-14T00:00:00Z') }
      return created
    },
  },
  user: { findUnique: async () => ({ name: 'Creator', userType: 'creator' }) },
  writerApplication: { findUnique: async () => ({ id: 'application', status: 'approved', encryptedPayload: 'encrypted' }) },
  creatorRevenueLedger: { aggregate: async () => ({ _sum: { amountSatang: 100_000 } }), create: async () => ({}) },
  withdrawalHistory: { create: async () => ({}) },
}
mock.module('@/lib/prisma', { namedExports: { getPrisma: () => ({
  withdrawalRequest: tx.withdrawalRequest,
  $transaction: async <T,>(callback: (client: typeof tx) => Promise<T>) => callback(tx),
}) } })
mock.module('@/lib/writer-application-crypto', { namedExports: {
  decryptWriterApplicationPayload: () => ({ bankName: 'Bank', accountNumber: '1234567890', accountName: 'Creator' }),
  encryptWithdrawalDestination: () => 'encrypted-destination',
} })

const { createWithdrawal } = await import('../lib/db/creator-studio')

test('same client key returns the original advance withdrawal without reserving twice', async () => {
  const key = '9cc3f853-36cb-4aa8-9a7e-aa6f58f7aeea'
  const first = await createWithdrawal('creator-a', 100, key)
  const second = await createWithdrawal('creator-a', 100, key)
  assert.deepEqual(second, first)
  assert.equal(creates, 1)
  await assert.rejects(createWithdrawal('creator-a', 200, key), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'INVALID_STATE')
  assert.equal(creates, 1)
})
