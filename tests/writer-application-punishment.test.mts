import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

let claimed = false
let promoted = false

const application = {
  id: 'application-a',
  userId: 'member-a',
  status: 'pending',
  user: { id: 'member-a', status: 'active' },
}

const transaction = {
  writerApplication: {
    findUnique: async () => application,
    updateMany: async () => { claimed = true; return { count: 1 } },
    findUniqueOrThrow: async () => application,
  },
  punishmentRecord: { findFirst: async () => ({ id: 'active-punishment' }) },
  user: { update: async () => { promoted = true } },
  creatorProfile: { upsert: async () => undefined },
  auditLog: { create: async () => undefined },
}

mock.module('@/lib/prisma', { exports: {
  getPrisma: () => ({ $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction) }),
} })
mock.module('@/lib/writer-application-crypto', { exports: { decryptWriterApplicationPayload: () => ({}) } })

const { decideWriterApplication, WriterApplicationReviewError } = await import('../lib/db/writer-applications')

test('active punishment blocks writer approval before any state change', async () => {
  claimed = false
  promoted = false
  await assert.rejects(
    () => decideWriterApplication({ id: 'application-a', decision: 'approved', adminId: 'admin-a' }),
    (error: unknown) => error instanceof WriterApplicationReviewError && error.code === 'INACTIVE_USER',
  )
  assert.equal(claimed, false)
  assert.equal(promoted, false)
})
