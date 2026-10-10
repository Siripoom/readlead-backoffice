import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { NextRequest } from 'next/server'

const admin = { id: 'users-only', isOwner: false, permissions: ['users'] }
let allowWriter = false

mock.module('@/lib/auth', {
  exports: {
    authorizeApi: async (permission: string) => permission === 'writer-applications' && !allowWriter
      ? { ok: false as const, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
      : { ok: true as const, admin },
  },
})

mock.module('@/lib/db/writer-applications', {
  exports: {
    listWriterApplications: async () => { throw new Error('unexpected list read') },
    getWriterApplicationDetail: async () => { throw new Error('unexpected detail read') },
    decideWriterApplication: async () => { throw new Error('unexpected decision') },
    getWriterApplicationDocument: async () => { throw new Error('unexpected document read') },
    recordWriterApplicationAudit: async () => { throw new Error('unexpected audit') },
    WriterApplicationReviewError: class extends Error {},
  },
})

mock.module('@/lib/storage/writer-documents', {
  exports: {
    downloadWriterDocument: async () => { throw new Error('unexpected download') },
    WriterDocumentStorageConfigError: class extends Error {},
  },
})

mock.module('@/lib/writer-application-crypto', {
  exports: { WriterApplicationEncryptionConfigError: class extends Error {} },
})

mock.module('@/lib/db/finance', {
  exports: { updateWithdrawalStatus: async () => { throw new Error('unexpected withdrawal decision') } },
})

const list = await import('../app/api/writer-applications/route')
const detail = await import('../app/api/writer-applications/[id]/route')
const document = await import('../app/api/writer-applications/[id]/documents/[kind]/route')
const withdrawals = await import('../app/api/finance/withdrawals/route')
const context = { params: Promise.resolve({ id: 'application-a' }) }

test('users-only admin cannot read or decide writer applications', async () => {
  const listResponse = await list.GET(new NextRequest('http://localhost/api/writer-applications'))
  const detailResponse = await detail.GET(new NextRequest('http://localhost/api/writer-applications/application-a'), context)
  const decisionResponse = await detail.PATCH(new NextRequest('http://localhost/api/writer-applications/application-a', {
    method: 'PATCH', body: JSON.stringify({ decision: 'approved' }),
  }), context)
  assert.deepEqual([listResponse.status, detailResponse.status, decisionResponse.status], [403, 403, 403])
})

test('users-only admin cannot open KYC documents', async () => {
  const response = await document.GET(new NextRequest('http://localhost/api/writer-applications/application-a/documents/identity'), {
    params: Promise.resolve({ id: 'application-a', kind: 'identity' }),
  })
  assert.equal(response.status, 403)
})

test('PATCH routes return 400 for null and malformed JSON bodies', async () => {
  allowWriter = true
  try {
  for (const body of ['null', '{']) {
    const withdrawalResponse = await withdrawals.PATCH(new NextRequest('http://localhost/api/finance/withdrawals', {
      method: 'PATCH', body,
    }))
    const writerResponse = await detail.PATCH(new NextRequest('http://localhost/api/writer-applications/application-a', {
      method: 'PATCH', body,
    }), context)
    assert.equal(withdrawalResponse.status, 400)
    assert.equal(writerResponse.status, 400)
  }
  } finally {
    allowWriter = false
  }
})
