import assert from 'node:assert/strict'
import test, { mock } from 'node:test'

type Level = { id: string; level: number; name: string; threshold: number; duration: number }

const admin = { id: 'admin-a', isOwner: false, permissions: ['punishment'] }
const auditCalls: Array<{ data: Record<string, unknown> }> = []
const createCalls: unknown[] = []
const updateCalls: unknown[] = []
let levelByNumber: Level | null = null
let levelById: Level | null = null

const prisma = {
  punishmentLevel: {
    findMany: async () => [],
    findUnique: async ({ where }: { where: { id?: string; level?: number } }) => (
      where.id ? levelById : levelByNumber
    ),
    create: async (args: { data: Omit<Level, 'id'> }) => {
      createCalls.push(args)
      return { id: 'level-new', ...args.data }
    },
    update: async (args: { where: { id: string }; data: Partial<Level> }) => {
      updateCalls.push(args)
      if (!levelById) throw Object.assign(new Error('Record not found'), { code: 'P2025' })
      return { ...levelById, ...args.data }
    },
  },
  auditLog: {
    create: async (args: { data: Record<string, unknown> }) => { auditCalls.push(args) },
  },
  $transaction: async <T>(callback: (transaction: typeof prisma) => Promise<T>) => callback(prisma),
}

mock.module('@/lib/auth', {
  exports: { authorizeApi: async () => ({ ok: true as const, admin }) },
})
mock.module('@/lib/prisma', {
  exports: { getPrisma: () => prisma },
})

const { POST, PATCH } = await import('../app/api/punishment/levels/route')

function request(method: 'POST' | 'PATCH', body: unknown) {
  return new Request('http://localhost/api/punishment/levels', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test.beforeEach(() => {
  auditCalls.length = 0
  createCalls.length = 0
  updateCalls.length = 0
  levelByNumber = null
  levelById = null
})

test('POST rejects malformed and negative level input', async () => {
  const wrongType = await POST(request('POST', { level: '2', name: 'พักใช้', threshold: 2, duration: 7 }))
  const negativeDuration = await POST(request('POST', { level: 2, name: 'พักใช้', threshold: 2, duration: -7 }))
  assert.equal(wrongType.status, 400)
  assert.equal(negativeDuration.status, 400)
  assert.equal(createCalls.length, 0)
})

test('POST returns conflict for a duplicate level number', async () => {
  levelByNumber = { id: 'existing', level: 2, name: 'เดิม', threshold: 2, duration: 7 }
  const response = await POST(request('POST', { level: 2, name: 'ซ้ำ', threshold: 3, duration: 14 }))
  assert.equal(response.status, 409)
  assert.equal(createCalls.length, 0)
})

test('POST creates a level and audit log in one transaction', async () => {
  const response = await POST(request('POST', { level: 2, name: ' พักใช้ ', threshold: 3, duration: 7 }))
  assert.equal(response.status, 201)
  assert.deepEqual(createCalls, [{ data: { level: 2, name: 'พักใช้', threshold: 3, duration: 7 } }])
  assert.equal(auditCalls.length, 1)
  assert.equal(auditCalls[0]?.data.action, 'punishment_level.created')
})

test('PATCH rejects a missing id and returns 404 for an unknown id', async () => {
  const missingId = await PATCH(request('PATCH', { duration: 7 }))
  const unknownId = await PATCH(request('PATCH', { id: 'missing', duration: 7 }))
  assert.equal(missingId.status, 400)
  assert.equal(unknownId.status, 404)
  assert.equal(updateCalls.length, 0)
})

test('PATCH validates changes and writes an audit log', async () => {
  levelById = { id: 'level-2', level: 2, name: 'พักใช้', threshold: 3, duration: 7 }
  const invalid = await PATCH(request('PATCH', { id: levelById.id, duration: -1 }))
  assert.equal(invalid.status, 400)

  const response = await PATCH(request('PATCH', { id: levelById.id, name: ' พักใช้ 14 วัน ', duration: 14 }))
  assert.equal(response.status, 200)
  assert.deepEqual(updateCalls, [{
    where: { id: 'level-2' },
    data: { name: 'พักใช้ 14 วัน', duration: 14 },
  }])
  assert.equal(auditCalls.length, 1)
  assert.equal(auditCalls[0]?.data.action, 'punishment_level.updated')
})
