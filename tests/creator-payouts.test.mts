import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

const attemptedUserIds: string[] = []
const balances = ['creator-1', 'creator-2', 'creator-3'].map((userId) => ({
  userId,
  _sum: { amountSatang: 20_000 },
}))

const transactionClient = {
  withdrawalRequest: {
    findUnique: async ({ where }: { where: { userId_payoutPeriod: { userId: string } } }) => {
      attemptedUserIds.push(where.userId_payoutPeriod.userId)
      return null
    },
    create: async ({ data }: { data: { userId: string } }) => ({ id: `withdrawal-${data.userId}` }),
  },
  user: {
    findUnique: async () => ({ name: 'Creator', userType: 'creator' }),
  },
  writerApplication: {
    findUnique: async () => ({ status: 'approved', encryptedPayload: 'encrypted' }),
  },
  creatorRevenueLedger: {
    aggregate: async () => ({ _sum: { amountSatang: 20_000 } }),
    create: async () => ({}),
  },
  withdrawalHistory: { create: async () => ({}) },
}

const prisma = {
  creatorRevenueLedger: { groupBy: async () => balances },
  $transaction: async <T,>(callback: (tx: typeof transactionClient) => Promise<T>) => {
    const nextUserId = balances[attemptedUserIds.length]?.userId
    if (nextUserId === 'creator-2') {
      attemptedUserIds.push(nextUserId)
      throw new Error('simulated transient database failure')
    }
    return callback(transactionClient)
  },
}

mock.module('@/lib/prisma', { namedExports: { getPrisma: () => prisma } })
mock.module('@/lib/writer-application-crypto', {
  namedExports: {
    decryptWriterApplicationPayload: () => ({ bankName: 'Bank', accountNumber: '1234567890', accountName: 'Creator' }),
    encryptWriterApplicationPayload: () => 'encrypted-destination',
  },
})

const { createAutomaticWithdrawalRequests } = await import('../lib/db/creator-studio')

test('continues automatic payouts after one creator has an unexpected error', async () => {
  const consoleError = mock.method(console, 'error', () => {})

  const result = await createAutomaticWithdrawalRequests(new Date('2026-09-25T00:00:00.000Z'))

  assert.deepEqual(attemptedUserIds, ['creator-1', 'creator-2', 'creator-3'])
  assert.deepEqual(result.results, [
    { userId: 'creator-1', id: 'withdrawal-creator-1' },
    { userId: 'creator-2', skipped: 'error' },
    { userId: 'creator-3', id: 'withdrawal-creator-3' },
  ])
  assert.equal(consoleError.mock.callCount(), 1)
  assert.equal(consoleError.mock.calls[0]?.arguments[0], 'Automatic creator payout skipped after unexpected error')
  assert.deepEqual(consoleError.mock.calls[0]?.arguments[1], {
    userId: 'creator-2',
    payoutPeriod: '2026-09',
    error: new Error('simulated transient database failure'),
  })
})
