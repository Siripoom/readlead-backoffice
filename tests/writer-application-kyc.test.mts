import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

type Application = { id: string; status: 'pending' | 'rejected'; penName: string; submittedAt: Date; rejectionReason: string | null }
type UpdateData = { penName: string; submittedAt: Date; identityObjectKey: string; bankObjectKey: string }
type CreateData = { penName: string; identityObjectKey: string; bankObjectKey: string }
const oldIdentity = 'old/identity.rlwd'
const oldBank = 'old/bank.rlwd'
let row: Application | null = null
let rowKeys = { identity: oldIdentity, bank: oldBank }
let failUpload: 'identity' | 'bank' | null = null
let failDatabase = false
let loseRace = false
let failCreateConflict = false
const uploads: string[] = []
const deletions: string[] = []

const prisma = {
  writerApplication: {
    findUnique: async () => row,
    updateMany: async ({ where, data }: { where: { status: string }; data: UpdateData }) => {
      if (failDatabase) throw new Error('database failed')
      if (loseRace || where.status !== 'rejected' || row?.status !== 'rejected') return { count: 0 }
      row = { id: row.id, status: 'pending', penName: data.penName, submittedAt: data.submittedAt, rejectionReason: null }
      rowKeys = { identity: data.identityObjectKey, bank: data.bankObjectKey }
      return { count: 1 }
    },
    update: async ({ data }: { data: UpdateData }) => {
      if (failDatabase) throw new Error('database failed')
      row = { id: 'application', status: 'pending', penName: data.penName, submittedAt: data.submittedAt, rejectionReason: null }
      rowKeys = { identity: data.identityObjectKey, bank: data.bankObjectKey }
      return row
    },
    create: async ({ data }: { data: CreateData }) => {
      if (failDatabase) throw new Error('database failed')
      if (failCreateConflict) throw Object.assign(new Error('unique conflict'), { code: 'P2002' })
      row = { id: 'application', status: 'pending', penName: data.penName, submittedAt: new Date(), rejectionReason: null }
      rowKeys = { identity: data.identityObjectKey, bank: data.bankObjectKey }
      return row
    },
  },
}

mock.module('@/lib/member-auth', { exports: { getMemberSessionUser: async () => ({ id: 'user-a', userType: 'member' }) } })
mock.module('@/lib/prisma', { exports: { getPrisma: () => prisma } })
mock.module('@/lib/writer-application-validation', { exports: {
  validateWriterApplicationForm: async () => ({ success: true, data: {
    applicantType: 'individual', penName: 'Writer', payload: {},
    identityFile: { body: Uint8Array.of(1), contentType: 'image/png' },
    bankFile: { body: Uint8Array.of(2), contentType: 'image/png' },
  } }),
} })
mock.module('@/lib/writer-application-crypto', { exports: {
  encryptWriterApplicationPayload: () => 'encrypted',
  WriterApplicationEncryptionConfigError: class extends Error {},
} })
mock.module('@/lib/storage/writer-documents', { exports: {
  uploadWriterDocument: async ({ userId, kind, attemptId }: { userId: string; kind: 'identity' | 'bank'; attemptId?: string }) => {
    if (failUpload === kind) throw new Error('upload failed')
    const key = `kyc/${userId}/${attemptId ?? 'stable'}/${kind}.rlwd`
    uploads.push(key)
    return { key }
  },
  deleteWriterDocument: async (key: string) => { deletions.push(key) },
  WriterDocumentStorageConfigError: class extends Error { missing: string[] = [] },
} })

const route = await import('/Users/a.siripoom/Developer/readlead-backoffice/app/api/auth/member/writer-application/route.ts')
const send = async () => {
  const form = new FormData()
  form.set('x', 'y')
  return route.POST(new Request('http://localhost/api/auth/member/writer-application', { method: 'POST', body: form }))
}
const reset = (status: 'pending' | 'rejected' | null) => {
  row = status ? { id: 'application', status, penName: 'Old', submittedAt: new Date('2026-01-01'), rejectionReason: status === 'rejected' ? 'retry' : null } : null
  rowKeys = { identity: oldIdentity, bank: oldBank }
  uploads.length = 0
  deletions.length = 0
  failUpload = null
  failDatabase = false
  loseRace = false
  failCreateConflict = false
}

test('resubmission uses unique keys and preserves previous evidence', async () => {
  reset('rejected')
  assert.equal((await send()).status, 201)
  const first = { ...rowKeys }
  assert.notEqual(first.identity, oldIdentity)
  assert.notEqual(first.bank, oldBank)
  assert.deepEqual(deletions, [])
  row = { ...row!, status: 'rejected', rejectionReason: 'retry' }
  assert.equal((await send()).status, 201)
  assert.notEqual(rowKeys.identity, first.identity)
  assert.notEqual(rowKeys.bank, first.bank)
  assert.deepEqual(deletions, [])
  const uploadedCount = uploads.length
  assert.equal((await send()).status, 409)
  assert.equal(uploads.length, uploadedCount)
})

test('a sibling upload failure cleans only new successful upload', async () => {
  reset('rejected')
  failUpload = 'bank'
  assert.equal((await send()).status, 500)
  assert.deepEqual(deletions, uploads)
  assert.deepEqual(rowKeys, { identity: oldIdentity, bank: oldBank })
})

test('database failure cleans both new keys and retains rejected row', async () => {
  reset('rejected')
  failDatabase = true
  assert.equal((await send()).status, 500)
  assert.deepEqual(new Set(deletions), new Set(uploads))
  assert.deepEqual(rowKeys, { identity: oldIdentity, bank: oldBank })
})

test('lost rejected to pending race returns conflict and deletes loser keys', async () => {
  reset('rejected')
  loseRace = true
  assert.equal((await send()).status, 409)
  assert.deepEqual(new Set(deletions), new Set(uploads))
  assert.deepEqual(rowKeys, { identity: oldIdentity, bank: oldBank })
})

test('simultaneous first submission loser removes only its own keys', async () => {
  reset(null)
  failCreateConflict = true
  assert.equal((await send()).status, 409)
  assert.deepEqual(new Set(deletions), new Set(uploads))
  assert.equal(row, null)
})
